"use client";

import styles from "./page.module.css";
import { useAuth } from "@/components/Auth/AuthProvider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePopupMessage } from "@/components/PopupMessage";
import InstallPrompt from "@/components/PWA/InstallPrompt";
import LoginBackground from "@/app/LoginBackground";

export default function Home() {
  const router = useRouter();
  const { setUser } = useAuth();
  const { notify } = usePopupMessage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      let data: { message?: string; user?: any } = {};

      try {
        data = await response.json();
      } catch {
        // Keep the HTTP status as the fallback if the API returns no JSON.
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Login failed, Invalid Credentials (${response.status})`,
        );
      }

      if (!data.user) {
        throw new Error("Login failed: user information was not returned.");
      }

      setUser(data.user);
      notify({ kind: "success", title: "Signed in successfully" });
      setWelcomeName(data.user.fullName ?? "");
      setShowWelcome(true);

      setTimeout(() => {
        router.push("/Pages/Dashboard");
      }, 1700);
    } catch (error) {
      notify({
        kind: "error",
        title: "Sign-in failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to sign in. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      {showWelcome && (
        <div className={styles.welcomeOverlay} role="status">
          <div className={styles.welcomeContent}>
            <div className={styles.welcomeLogo}>
              <img src="/favicon.ico" alt="" />
            </div>

            <h1>HotelFlow</h1>

            <p>
              {welcomeName
                ? `Welcome back, ${welcomeName}`
                : "Preparing your workspace"}
            </p>

            <div className={styles.progressTrack}>
              <div className={styles.progressBar} />
            </div>
          </div>
        </div>
      )}

      <LoginBackground />

      <div className={styles.container}>
        <section className={styles.leftPanel}>
          <div className={styles.brand}>
            <div className={styles.logo}>
              <img src="/favicon.ico" alt="HotelFlow Logo" />
            </div>
           

            <h1>HotelFlow</h1>
            <p></p>
          </div>

          <div className={styles.quote}>
            <h2>
              "Every room ready. Every
              <br />
              handoff clear. One place
              <br />
              for the whole team."
            </h2>

            <p>— Built for independent hotels</p>
          </div>

          <div className={styles.footer}>
            <span>© 2026 HotelFlow</span>
            <span>Need help? Contact your admin</span>
          </div>
        </section>

        <section className={styles.rightPanel}>
          <div className={styles.loginBox}>
            <h2>Sign In</h2>
            <p className={styles.subtitle}>
              Enter your credentials to access your dashboard
            </p>

            <InstallPrompt />

            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="email">EMAIL OR USERNAME</label>
                <input
                  id="email"
                  type="text"
                  placeholder="Enter your email or username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={40}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="password">PASSWORD</label>

                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={20}
                />
              </div>
              <button
                type="submit"
                className={styles.signInButton}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className={styles.spinner} aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>

              <p className={styles.redirectText}>
                You'll be taken to your dashboard automatically.
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}