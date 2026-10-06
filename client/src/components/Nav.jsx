import { Link, useNavigate } from "react-router-dom";
import { WalletCards, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="topbar">
      <Link to={user ? "/dashboard" : "/"} className="brand">
        <WalletCards size={19} style={{ verticalAlign: "-4px", marginRight: "0.4rem" }} />
        Split
      </Link>
      <div className="topbar-actions">
        {user ? (
          <>
            <span className="topbar-user">{user.name}</span>
            <button className="btn btn-ghost" onClick={handleLogout}>
              <LogOut size={15} /> Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost">
              Log in
            </Link>
            <Link to="/signup" className="btn btn-gold">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
