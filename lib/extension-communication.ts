export const GRADEZY_EXTENSION_ID =
  "iocfhndobdbbiemehcnpfnippohngocn";

export type ExtensionStudent = {
  ncgId: string;
  firstName: string;
  lastName: string;
  grade?: string;
  source?: string;
};

export type GradeData = {
  name: string;
  grade: number;
  source: "Canvas" | "Moodle" | "Table" | string;
};

export type ExtensionPageInfo = {
  url?: string;
  title?: string;
  hostname?: string;
  source?: string;
  studentCount?: number;
};

export type ExtensionMessage =
  | { action: "gradezyPing" }
  | { action: "readStaffAdvantageStudents" }
  | { action: "getStaffAdvantagePageInfo" }
  | { action: "extractGrades"; payload?: Record<string, unknown> }
  | { action: "extractStudents"; payload?: Record<string, unknown> }
  | { action: "getPageInfo" }
  | {
      action: "sendGradesToAssessment";
      payload: {
        assessmentId: string;
        grades: GradeData[];
      };
    }
  | { action: "requestGrades"; payload?: Record<string, unknown> };

export type ExtensionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

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
    addListener: (...args: any[]) => void;
    removeListener: (...args: any[]) => void;
  };
};

type ChromeLike = {
  runtime?: ChromeRuntime;
};

function getChromeRuntime(): ChromeRuntime | null {
  if (typeof window === "undefined") {
    return null;
  }

  const browserWindow = window as Window & {
    chrome?: ChromeLike;
  };

  return browserWindow.chrome?.runtime ?? null;
}

function canUseExtensionMessaging(): boolean {
  const runtime = getChromeRuntime();

  return Boolean(
    runtime &&
      typeof runtime.sendMessage === "function"
  );
}

function sendToExtension<T>(
  message: ExtensionMessage
): Promise<ExtensionResponse<T>> {
  return new Promise((resolve, reject) => {
    const runtime = getChromeRuntime();

    if (!runtime || !canUseExtensionMessaging()) {
      reject(
        new Error(
          "Gradezy Extension messaging is not available."
        )
      );
      return;
    }

    runtime.sendMessage(
      GRADEZY_EXTENSION_ID,
      message,
      (response) => {
        if (runtime.lastError) {
          reject(
            new Error(
              runtime.lastError.message ||
                "Could not connect to the Gradezy Extension."
            )
          );
          return;
        }

        if (!response) {
          reject(
            new Error(
              "No response was received from the Gradezy Extension."
            )
          );
          return;
        }

        resolve(response as ExtensionResponse<T>);
      }
    );
  });
}

/**
 * Checks whether the actual Gradezy Extension responds.
 */
export async function pingExtension(): Promise<{
  available: boolean;
  version?: string;
  extension?: string;
}> {
  try {
    const response = await sendToExtension<{
      extension?: string;
      version?: string;
    }>({
      action: "gradezyPing",
    });

    return {
      available: response.success === true,
      version: response.data?.version,
      extension: response.data?.extension,
    };
  } catch {
    return {
      available: false,
    };
  }
}

/**
 * Imports students directly from StaffAdvantage.
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

  if (!response.success) {
    throw new Error(
      response.error ||
        "Could not read student records from StaffAdvantage."
    );
  }

  return response.data?.students ?? [];
}

/**
 * Gets information about the page currently open in the browser.
 */
export async function requestPageInfoFromExtension(): Promise<
  ExtensionPageInfo | null
> {
  try {
    const response =
      await sendToExtension<ExtensionPageInfo>({
        action: "getStaffAdvantagePageInfo",
      });

    if (!response.success) {
      return null;
    }

    return response.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Legacy grade request support.
 */
export async function requestGradesFromExtension(): Promise<
  GradeData[]
> {
  const response =
    await sendToExtension<{
      grades?: GradeData[];
    }>({
      action: "requestGrades",
    });

  if (!response.success) {
    throw new Error(
      response.error ||
        "Could not retrieve grades from the extension."
    );
  }

  return response.data?.grades ?? [];
}

export async function sendGradesToAssessment(
  assessmentId: string,
  grades: GradeData[]
): Promise<void> {
  const response = await sendToExtension({
    action: "sendGradesToAssessment",
    payload: {
      assessmentId,
      grades,
    },
  });

  if (!response.success) {
    throw new Error(
      response.error ||
        "Could not send grades to the assessment."
    );
  }
}

/**
 * Kept for backwards compatibility.
 *
 * Note:
 * This only checks whether Chrome exposes runtime messaging.
 * Use pingExtension() when you need to know whether
 * the actual Gradezy Extension is installed and responding.
 */
export function isExtensionAvailable(): boolean {
  return canUseExtensionMessaging();
}