import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <main>
      <section className="hero">
        <h1>One shared tab. Nobody keeps score in their head.</h1>
        <p>
          Log what everyone spends, split it evenly or by exact amount, and Split
          works out the smallest set of payments to bring everyone back to zero.
        </p>
        <div className="hero-actions">
          <Link to="/signup" className="btn btn-gold">
            Start a group
          </Link>
          <Link to="/login" className="btn btn-ghost">
            Log in
          </Link>
        </div>

        <div className="ledger-sample">
          <div className="ledger-sample-row">
            <span>Groceries — Reliance Fresh</span>
            <span className="who">Riya paid · ₹1,240.00</span>
          </div>
          <div className="ledger-sample-row">
            <span>Electricity bill</span>
            <span className="who">Arjun paid · ₹2,100.00</span>
          </div>
          <div className="ledger-sample-row">
            <span>Wifi, October</span>
            <span className="who">Meera paid · ₹999.00</span>
          </div>
        </div>
      </section>
    </main>
  );
}
