import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-mark">C</div>
        <h1>COSTAATT Admissions Letters</h1>
        <p>
          Sign-in is designed for Microsoft Entra ID. Configure the Entra variables in the environment before enabling
          production access.
        </p>
        <Link className="button" href="/">
          Continue to MVP Workspace
        </Link>
      </section>
    </main>
  );
}
