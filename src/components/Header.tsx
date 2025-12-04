import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChefHat, LogOut } from "lucide-react"; 
import { useAuth } from "@/hooks/useAuth";

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/'); 
  };

  return (
    <nav 
      className="flex items-center justify-between px-8 py-4 bg-[#FFE4E1] shadow-md 
                 fixed top-0 w-full z-10"
    >
      <Link to="#hero-section" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <div className="flex items-center gap-2 cursor-pointer">
            <ChefHat className="w-8 h-8 text-[#E91E63]" />
            <span className="text-2xl font-bold text-[#E91E63]">KitchenFlow</span>
        </div>
    </Link>
      

    
      <div className="flex items-center gap-6">
        <Link to="/" className="text-lg font-medium text-black hover:text-gray-700">
          Home
        </Link>

        {/* Login Status Check */}
        {user ? (
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" className="text-lg font-medium text-black hover:bg-black/5">
                Dashboard
              </Button>
            </Link>
            <Button 
              onClick={handleSignOut}
              variant="outline" 
              className="border-[#E91E63] text-[#E91E63] hover:bg-[#E91E63] hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        ) : (
          <Link to="/auth">
            <Button 
              variant="ghost" 
              className="text-lg font-medium text-black hover:bg-black/5 hover:text-black"
            >
              Login
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Header;