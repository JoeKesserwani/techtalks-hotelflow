import styles from "./page.module.css";

export default function Home() {
  return (
     <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.leftPanel}>
          <div className={styles.brand}>
            <div className={styles.logo}>H</div>

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

            <form>
              <div className={styles.formGroup}>
                <label htmlFor="email">EMAIL OR USERNAME</label>
                <input
                  id="email"
                  type="text"
                  placeholder="Enter your email or username"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="password">PASSWORD</label>

                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                />
              </div>
              <button type="submit" className={styles.signInButton}>
                Sign in
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
