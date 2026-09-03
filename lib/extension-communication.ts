/**
 * Gradezy Extension Communication
 *
 * Communication between the Gradezy web app and the
 * StaffAdvantage Grade Filler browser extension.
 *
 * Flow:
 *
 * Gradezy
 *    ↓
 * Browser extension
 *    ↓
 * StaffAdvantage content script
 *    ↓
 * Student records
 *    ↓
 * Gradezy reconciliation engine
 */

export const GRADEZY_EXTENSION_ID =
  "iocfhndobdbbiemehcnpfnippohngocn";

/**
 * A student record returned by StaffAdvantage.
 */
export type ExtensionStudent = {
  ncgId: string;
  firstName: string;
  lastName: string;
  grade?: string;
  source?: string;
};

/**
 * Grade data that can be sent between Gradezy
 * and the browser extension.
 */
export type GradeData = {
  name: string;
  grade: number;
  source: "Canvas" | "Moodle" | "Table" | string;
};

/**
 * Information about the StaffAdvantage page.
 */
export type ExtensionPageInfo = {
  url?: string;
  title?: string;
  hostname?: string;
  source?: string;
  studentCount?: number;
};

/**
 * Messages Gradezy can send to the extension.
 */
export type ExtensionMessage =
  | {
      action: "gradezyPing";
    }
  | {
      action: "readStaffAdvantageStudents";
    }
  | {
      action: "getStaffAdvantagePageInfo";
    }
  | {
      action: "extractGrades";
      payload?: Record<string, unknown>;
    }
  | {
      action: "extractStudents";
      payload?: Record<string, unknown>;
    }
  | {
      action: "getPageInfo";
    }
  | {
      action: "sendGradesToAssessment";
      payload: {
        assessmentId: string;
        grades: GradeData[];
      };
    }
  | {
      action: "requestGrades";
      payload?: Record<string, unknown>;
    };

/**
 * Standard extension response.
 */
export type ExtensionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Minimal Chrome runtime types needed by Gradezy.
 *
 * We define only what this web app actually uses instead
 * of requiring the full Chrome extension type package.
 */
type ChromeRuntime = {
  sendMessage: (
    extensionId: string,
    message: ExtensionMessage,
    callback: (
      response: ExtensionResponse<unknown> | undefined
    ) => void
  ) => void;

  lastError?: {
    message?: string;
  };

  onMessage?: {
    addListener: (
      listener: (
        request: {
          action?: string;
          data?: unknown;
          sourceUrl?: string;
        },
        sender: unknown,
        sendResponse: (
          response: ExtensionResponse<unknown>
        ) => void
      ) => void
    ) => void;

    removeListener: (
      listener: (
        request: {
          action?: string;
          data?: unknown;
          sourceUrl?: string;
        },
        sender: unknown,
        sendResponse: (
          response: ExtensionResponse<unknown>
        ) => void
      ) => void
    ) => void;
  };
};

type ChromeLike = {
  runtime?: ChromeRuntime;
};

/**
 * Safely access the browser's extension runtime.
 *
 * The Gradezy website runs in a normal browser page, so
 * Chrome/Edge extension APIs are not guaranteed to exist.
 */
function getChromeRuntime(): ChromeRuntime | null {
  if (typeof window === "undefined") {
    return null;
  }

  const browserWindow = window as Window & {
    chrome?: ChromeLike;
  };

  return browserWindow.chrome?.runtime ?? null;
}

/**
 * Check whether the browser supports the extension
 * messaging API.
 */
function canUseExtensionMessaging(): boolean {
  const runtime = getChromeRuntime();

  return (
    runtime !== null &&
    typeof runtime.sendMessage === "function"
  );
}

/**
 * Send a message directly to the Gradezy browser extension.
 *
 * IMPORTANT:
 * Because Gradezy is a web page and the extension is a
 * separate extension, the extension ID must be supplied.
 */
export async function sendToExtension<
  T = unknown
>(
  message: ExtensionMessage
): Promise<ExtensionResponse<T>> {
  return new Promise((resolve, reject) => {
    const runtime = getChromeRuntime();

    if (
      !runtime ||
      typeof runtime.sendMessage !== "function"
    ) {
      reject(
        new Error(
          "Browser extension messaging is not available."
        )
      );

      return;
    }

    try {
      runtime.sendMessage(
        GRADEZY_EXTENSION_ID,
        message,
        (
          response:
            | ExtensionResponse<unknown>
            | undefined
        ) => {
          const runtimeError = runtime.lastError;

          if (runtimeError) {
            reject(
              new Error(
                runtimeError.message ||
                  "Could not connect to the Gradezy browser extension."
              )
            );

            return;
          }

          if (!response) {
            reject(
              new Error(
                "No response was received from the Gradezy browser extension."
              )
            );

            return;
          }

          resolve(
            response as ExtensionResponse<T>
          );
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Check whether the StaffAdvantage Grade Filler
 * extension is installed and responding.
 */
export async function pingExtension(): Promise<boolean> {
  try {
    const response =
      await sendToExtension<{
        extension?: string;
        version?: string;
      }>({
        action: "gradezyPing",
      });

    return response.success === true;
  } catch {
    return false;
  }
}

/**
 * Request student records directly from the
 * StaffAdvantage page.
 *
 * This is the main Gradezy ingestion method.
 */
export async function requestStudentsFromExtension(): Promise<
  ExtensionStudent[]
> {
  const response =
    await sendToExtension<{
      students?: ExtensionStudent[];
      count?: number;
    }>({
      action: "readStaffAdvantageStudents",
    });

  if (
    !response.success ||
    !response.data ||
    !Array.isArray(response.data.students)
  ) {
    throw new Error(
      response.error ||
        "The extension could not read student records from StaffAdvantage."
    );
  }

  return response.data.students;
}

/**
 * Request information about the StaffAdvantage
 * page currently open.
 */
export async function requestPageInfoFromExtension(): Promise<
  ExtensionPageInfo | null
> {
  try {
    const response =
      await sendToExtension<ExtensionPageInfo>({
        action: "getStaffAdvantagePageInfo",
      });

    if (
      !response.success ||
      !response.data
    ) {
      return null;
    }

    return response.data;
  } catch (error) {
    console.error(
      "Failed to get StaffAdvantage page information:",
      error
    );

    return null;
  }
}

/**
 * Legacy-compatible grade extraction helper.
 */
export async function requestGradesFromExtension(): Promise<
  GradeData[]
> {
  try {
    const response =
      await sendToExtension<GradeData[]>({
        action: "extractGrades",
      });

    if (
      response.success &&
      Array.isArray(response.data)
    ) {
      return response.data;
    }

    return [];
  } catch (error) {
    console.error(
      "Failed to extract grades:",
      error
    );

    return [];
  }
}

/**
 * Send grades from Gradezy to the assessment
 * system through the extension.
 */
export async function sendGradesToAssessment(
  assessmentId: string,
  grades: GradeData[]
): Promise<boolean> {
  try {
    const response =
      await sendToExtension({
        action: "sendGradesToAssessment",
        payload: {
          assessmentId,
          grades,
        },
      });

    return response.success === true;
  } catch (error) {
    console.error(
      "Failed to send grades:",
      error
    );

    return false;
  }
}

/**
 * Legacy listener retained for compatibility.
 *
 * The primary Gradezy → Extension flow now uses
 * external messaging. This listener can still support
 * an extension pushing information into the page if
 * the extension implements that later.
 */
export function listenForExtensionMessages(
  callback: (
    message: ExtensionIncomingMessage
  ) => void
): () => void {
  const runtime = getChromeRuntime();

  if (
    !runtime ||
    !runtime.onMessage
  ) {
    return () => {};
  }

  const listener = (
    request: {
      action?: string;
      data?: unknown;
      sourceUrl?: string;
    },
    _sender: unknown,
    sendResponse: (
      response: ExtensionResponse<unknown>
    ) => void
  ) => {
    if (
      request.action ===
      "receiveGradesFromExtension"
    ) {
      callback({
        type: "gradesReceived",
        data: Array.isArray(request.data)
          ? (request.data as GradeData[])
          : [],
        sourceUrl: request.sourceUrl,
      });

      sendResponse({
        success: true,
      });

      return;
    }

    if (
      request.action ===
      "receiveStudentsFromExtension"
    ) {
      callback({
        type: "studentsReceived",
        data: Array.isArray(request.data)
          ? (request.data as ExtensionStudent[])
          : [],
        sourceUrl: request.sourceUrl,
      });

      sendResponse({
        success: true,
      });

      return;
    }

    if (
      request.action ===
      "receivePageInfoFromExtension"
    ) {
      callback({
        type: "pageInfoReceived",
        data:
          request.data &&
          typeof request.data === "object"
            ? (request.data as ExtensionPageInfo)
            : {},
        sourceUrl: request.sourceUrl,
      });

      sendResponse({
        success: true,
      });

      return;
    }

    sendResponse({
      success: false,
      error: "Unknown extension message.",
    });
  };

  runtime.onMessage.addListener(listener);

  return () => {
    runtime.onMessage?.removeListener(listener);
  };
}

/**
 * Incoming messages supported by the
 * legacy push-based communication model.
 */
export type ExtensionIncomingMessage =
  | {
      type: "gradesReceived";
      data: GradeData[];
      sourceUrl?: string;
    }
  | {
      type: "studentsReceived";
      data: ExtensionStudent[];
      sourceUrl?: string;
    }
  | {
      type: "pageInfoReceived";
      data: ExtensionPageInfo;
      sourceUrl?: string;
    };

/**
 * Synchronous check for whether the browser exposes
 * extension runtime functionality.
 *
 * This only means the API exists. For a definitive
 * check that our extension is installed, use pingExtension().
 */
export function isExtensionAvailable(): boolean {
  return canUseExtensionMessaging();
}