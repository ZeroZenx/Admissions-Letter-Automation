import { LoginClient } from "@/components/login-client";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-mark">C</div>
        <h1>COSTAATT Admissions Letters</h1>
        <LoginClient />
      </section>
    </main>
  );
}
