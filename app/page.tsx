import type { Metadata } from "next";
import Link from "next/link";
import s from "./landing.module.css";

const extension = "https://microsoftedge.microsoft.com/addons/detail/staffadvantage-grade-fill/iocfhndobdbbiemehcnpfnippohngocn";
export const metadata: Metadata = {
  title: "Gradezy — Less admin. More assurance.",
  description: "Your assessment companion. Bring Moodle exports, Excel records and grade entry into a simpler workflow with Gradezy for Microsoft Edge.",
};
function Arrow() { return <span aria-hidden="true">↗</span>; }
function Mark() { return <span className={s.mark} aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M23 11a9 9 0 1 0 1 11V16h-9" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="m20 7 3 4 5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>; }
export default function Home() {
  return <main className={s.page}>
    <a href="#content" className={s.skip}>Skip to content</a>
    <header className={s.header}>
      <Link href="/" className={s.logo} aria-label="Gradezy home"><Mark/>gradezy<span className={s.dot}>.</span></Link>
      <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><Link href="/tools/tracker-sync" className={s.workspaceLink}>Open workspace <Arrow/></Link></nav>
    </header>
    <section id="content" className={s.hero}>
      <div className={s.heroCopy}>
        <div className={s.eyebrow}><span/> THE ASSESSMENT COMPANION</div>
        <h1>Less admin.<br/>More <em>assurance.</em></h1>
        <p>Bring your assessment workflow together. Match records, review grades and move through the repetitive work with confidence.</p>
        <div className={s.actions}><a href={extension} className={s.primary} target="_blank" rel="noopener noreferrer">Get the Edge extension <Arrow/></a><Link href="/extension-preview" className={s.secondary}>Try the interactive demo <span aria-hidden="true">→</span></Link></div>
        <div className={s.smallNote}><span aria-hidden="true">✓</span> Built for the systems you already use.</div>
      </div>
      <div className={s.visual} aria-label="Illustration of the Gradezy grade matching workflow">
        <div className={s.orbit}/><div className={s.visualLabel}>A LITTLE LESS REPETITION.</div>
        <div className={s.product}>
          <div className={s.productHeader}><div className={s.miniLogo}><Mark/>gradezy.</div><span className={s.browserBadge}>BROWSER COMPANION</span></div>
          <div className={s.productBody}><div className={s.previewTop}><span>StaffAdvantage</span><span className={s.status}><i/> Ready to review</span></div><h2>Your grades.<br/>In the right places.</h2><div className={s.steps}><span>01 Upload</span><span className={s.activeStep}>02 Match</span><span>03 Review</span></div><div className={s.table}><div className={s.tableHead}><span>STUDENT ID</span><span>GRADE</span><span>STATUS</span></div>{[["NCG 100241","68"],["NCG 100242","72"],["NCG 100243","54"]].map(([id,grade])=><div className={s.tableRow} key={id}><span>{id}</span><strong>{grade}</strong><span className={s.matched}>✓ Matched</span></div>)}</div><div className={s.reviewBar}><span><i/> Match by student ID</span><span>Review before applying →</span></div></div>
          <div className={s.productFooter}><span>ILLUSTRATIVE PREVIEW</span><span>You stay in control.</span></div>
        </div>
        <div className={s.floatingNote}><span className={s.check}>✓</span><div>One calmer workflow.<small>From export to entry.</small></div></div>
      </div>
    </section>
    <section className={s.systems} aria-label="Systems used in the assessment workflow"><span>FITS INTO YOUR WORKING DAY</span><div><b>Moodle</b><i>+</i><b>Excel</b><i>+</i><b>SharePoint</b><i>+</i><b>StaffAdvantage</b></div></section>
    <section className={s.workflow} id="how-it-works"><div className={s.sectionHeading}><div><span className={s.eyebrow}>FROM EXPORT TO ENTRY</span><h2>A simpler way<br/>through assessments.</h2></div><p>Less moving between spreadsheets.<br/>More clarity at every step.</p></div><div className={s.featureGrid}>{[
      ["01","Bring records together","Work with Moodle exports and Excel files to prepare your assessment records."],
      ["02","Find the right match","Match student identifiers and Paper IDs, and see which records need a closer look."],
      ["03","Review. Then apply.","Use the Edge extension to match grades to StaffAdvantage fields and approve the changes."]
    ].map(([n,title,body])=><article key={n}><span className={s.number}>{n}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className={s.finalCta}><div><span className={s.eyebrow}>MAKE ROOM FOR THE WORK THAT MATTERS</span><h2>Your next assessment,<br/>with less busywork.</h2></div><a href={extension} target="_blank" rel="noopener noreferrer" className={s.primary}>Get Gradezy for Edge <Arrow/></a></section>
    <footer className={s.footer}><Link href="/" className={s.logo}><Mark/>gradezy.</Link><span>A little order. A lot less admin.</span><div><Link href="/tools/tracker-sync">Workspace <Arrow/></Link><a href="mailto:iamjasanyakay@gmail.com">Contact <Arrow/></a></div></footer>
  </main>;
}
