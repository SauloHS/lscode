export function Highlight() {
  return (
    <section className="highlight" id="features">
      <div className="highlight-text">
        <h2>All that you know. No dead weight.</h2>
        <p>
          Same shortcuts, same layout, same muscle memory. Built on Tauri instead of Electron, so it starts fast and stays out of your way.
        </p>
      </div>
      <div className="highlight-image">
        <div className="highlight-image-frame">
          <img src="/images/2.png" alt="LS Code layout and autocomplete" className="highlight-screenshot"/>
        </div>
      </div>
    </section>
  )
}
