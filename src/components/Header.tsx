import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChefHat , Menu, X } from "lucide-react"; 
import { useAuth } from "@/hooks/useAuth";
import React, { useState } from 'react';

 
const Header = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

 
    const [isMenuOpen, setIsMenuOpen] = useState(false); 

    const handleSignOut = async () => {
        await signOut();
    };

 // Header.jsx में return () के अंदर

return (
  <nav 
    className="flex items-center justify-between px-4 sm:px-8 py-4 bg-[#FFE4E1] shadow-md 
               fixed top-0 w-full z-20" /* z-index बढ़ाया गया */
  >
    {/* 1. Logo Section (No Change) */}
    <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <div className="flex items-center gap-1 sm:gap-2 cursor-pointer flex-shrink-0">
        <ChefHat className="w-6 h-6 sm:w-8 sm:h-8 text-[#E91E63]" />
        <span className="text-xl sm:text-2xl font-bold text-[#E91E63]">KitchenFlow</span>
      </div>
    </Link>

    {/* 2. Menu Button (Visible only on mobile/small screen) */}
    <button 
        className="sm:hidden p-2 text-[#E91E63] z-50"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
    >
        {isMenuOpen ? (
            <X className="w-6 h-6" /> // Menu खुला है, तो Cross दिखाएँ
        ) : (
            <Menu className="w-6 h-6" /> // Menu बंद है, तो Hamburger दिखाएँ
        )}
    </button>
      
    {/* 3. Desktop/Main Navigation Links (Hidden on small screen) */}
    <div className="hidden sm:flex items-center gap-6"> 
        <Link to="/" className="text-lg font-medium text-black hover:text-[#e91e63]">
            Home
        </Link>
        {/* ... Login Status Check and Buttons for desktop (वही रहेगा) ... */}
        {user ? (
            <div className="flex items-center gap-4"> 
                <Link to="/dashboard">
                    <Button variant="ghost" className="text-lg font-medium text-black hover:bg-[#e91e63]/20 hover:text-[#e91e63] px-4 py-1">
                        Dashboard
                    </Button>
                </Link>
                <Button 
                    onClick={handleSignOut}
                    variant="outline" 
                    className="border-[#E91E63] text-md text-[#E91E63] hover:bg-[#E91E63] hover:text-white px-4 py-1"
                >
                    Sign Out
                </Button>
            </div>
        ) : (
            <Link to="/auth">
                <Button 
                    variant="ghost" 
                    className="text-lg font-medium text-black hover:bg-[#e91e63] hover:text-white px-3 py-1"
                >
                    Login
                </Button>
            </Link>
        )}
    </div>

    {/* 4. Mobile Menu (Opens when isMenuOpen is true) */}
    <div 
        className={`fixed inset-0 top-[60px] bg-[#FFE4E1] transition-transform duration-300 transform 
                    ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'} 
                    sm:hidden flex flex-col items-center pt-8 space-y-4 z-10`}
        onClick={() => setIsMenuOpen(false)} // लिंक पर क्लिक करने पर मेनू बंद हो जाएगा
    >
        <Link to="/" className="text-xl font-medium text-black hover:text-[#e91e63]">
            Home
        </Link>
        
        {user ? (
            <>
                <Link to="/dashboard">
                    <Button variant="ghost" className="text-xl font-medium text-black hover:bg-[#e91e63]/20 hover:text-[#e91e63]">
                        Dashboard
                    </Button>
                </Link>
                <Button 
                    onClick={handleSignOut}
                    variant="outline" 
                    className="w-[60%] max-w-xs border-[#E91E63] text-xl text-[#E91E63] hover:bg-[#E91E63] hover:text-white py-3 mt-4"
                >
                    Sign Out
                </Button>
            </>
        ) : (
            <Link to="/auth">
                <Button 
                    variant="ghost" 
                    className="text-xl font-medium text-black hover:bg-[#e91e63] hover:text-white"
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