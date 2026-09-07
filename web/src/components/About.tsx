export function About() {
  return (
    <section className="about"id="about">
      <article>
        <h2>LS Code</h2>
        <p>LS Code is a lightweight alternative to <a href="https://code.visualstudio.com">Visual Studio Code</a>, built on
          Tauri, instead of Electron, so memory usage and build sizes are significantly less.</p>
        <p>Our main goal is to get the closest as possible to VS Code, which includes its extensive customization,
        marketplace and features.</p>
        <h2>Why?</h2>
        <p>VS Code is heavy. It can easily use up to 1GB of ram just to boot. There are many alternatives, such as Neovim,
        but VS Code's great community, extensions, and features make it hard to switch over. That's where LS Code comes in:
        It is just like VS Code, but uses way less memory.</p>
      </article>
    </section>
  );
}
