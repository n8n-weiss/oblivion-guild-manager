import React from "react";

export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Unexpected page error" };
  }

  componentDidCatch(error) {
    console.error("Page runtime error:", error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ marginTop: 10, padding: 20, border: "1px solid rgba(224,80,80,0.35)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--red)", marginBottom: 8 }}>
            Page crashed unexpectedly
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
            {this.state.message}
          </div>
          <button className="btn btn-danger btn-sm" onClick={this.handleReload}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
