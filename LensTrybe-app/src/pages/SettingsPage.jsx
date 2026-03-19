function SettingsPage() {
  return (
    <section>
      <header className="page-header">
        <h2>Settings</h2>
        <p>Manage workspace preferences and account options.</p>
      </header>

      <article className="panel">
        <h3>Notification Preferences</h3>
        <form className="settings-form">
          <label>
            <input type="checkbox" defaultChecked />
            Email alerts
          </label>
          <label>
            <input type="checkbox" defaultChecked />
            Weekly summary
          </label>
          <label>
            <input type="checkbox" />
            Push notifications
          </label>
        </form>
      </article>
    </section>
  )
}

export default SettingsPage
