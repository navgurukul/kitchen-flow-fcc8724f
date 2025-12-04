import React from 'react';
import { Link } from "react-router-dom";
// Using Lucide-React icons for consistency, which match the look of Font Awesome/Fa-icons
import { Linkedin, Github, Phone, Facebook, Twitter, ChefHat } from "lucide-react"; 

// --- Developer Contact Link Component ---
const DevContact = ({ name, linkedInUrl, githubUrl, phoneUrl }) => (
    <div className="flex flex-col items-center">
        <h4 className="font-semibold text-lg text-gray-800 mb-2">{name}</h4>
        <div className="flex space-x-3">
            {/* LinkedIn Icon */}
            <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" 
               className="p-3 border border-gray-400 rounded-full text-[#E91E63] hover:bg-[#E91E63] hover:text-white transition-all duration-200">
                <Linkedin className="w-4 h-4" />
            </a>
            {/* GitHub Icon */}
            <a href={githubUrl} target="_blank" rel="noopener noreferrer" 
               className="p-3 border border-gray-400 rounded-full text-[#E91E63] hover:bg-[#E91E63] hover:text-white transition-all duration-200">
                <Github className="w-4 h-4" />
            </a>
            {/* Phone/Call Icon */}
            <a href={phoneUrl} 
               className="p-3 border border-gray-400 rounded-full text-[#E91E63] hover:bg-[#E91E63] hover:text-white transition-all duration-200">
                <Phone className="w-4 h-4" />
            </a>
        </div>
    </div>
);


const Footer = () => {
    
    // Developer data and actual links taken from your previous component
    const devData = [
        { name: "Prachi", linkedIn: "https://www.linkedin.com/in/prachi-kurwale-9545422bb/", github: "https://github.com/Prachikurwale", phone: "tel:+918208704528" },
        
        { name: "Nikita", linkedIn: "https://www.linkedin.com/in/nikitapanwar24/", github: "https://github.com/panwarnikita", phone: "tel:+919340194046" },
        { name: "Renuka", linkedIn: "https://www.linkedin.com/in/renuka-chouhan-05320432a/", github: "https://github.com/renukachouhan-24", phone: "tel:+918305319363" }
    ];

    const handleScrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    return (
        <footer className="bg-[#FFE4E1] py-10 mt-12">
            <div className="container mx-auto px-4">
                
                {/* 1. TOP SECTION: Logo, Links, and AJMF Logo */}
                <div className="flex flex-col md:flex-row justify-between items-start border-b border-gray-400/50 pb-8 mb-8 space-y-8 md:space-y-0">
                    
                    {/* Column 1: Logo & Description & Social Icons */}
                    <div className="max-w-xs space-y-3">
                        {/* Logo: navgurukul KitchenFlow (FIXED LOGO TEXT) */}
                        <Link to="/" onClick={handleScrollToTop} className="cursor-pointer inline-block">
                           <div className="text-[1.8rem] leading-none font-extrabold">
        {/* 🎉 Applying font-samarkan class here */}
        <span className="text-[#E91E63] font-samarkan">nav</span>
        <span className="text-gray-900 font-samarkan">gurukul</span>
    </div>
                            <div className="text-4xl font-black text-[#E91E63] leading-none -mt-1">
                                
                            </div>
                        </Link>
                        
                        <p className="text-gray-700 text-sm">
                            KitchenFlow is a project by Navgurukul students, designed to manage kitchen duties efficiently and fairly.
                        </p>
                        
                        {/* Navgurukul Social Media Links (omitted for brevity) */}
                        <div className="flex space-x-3 pt-2">
                            <a href="https://www.facebook.com/navgurukul" target="_blank" rel="noopener noreferrer" 
                               className="p-2 border-2 border-[#E91E63] rounded-full text-[#E91E63] hover:bg-[#E91E63] hover:text-white transition">
                                <Facebook className="w-5 h-5" />
                            </a>
                            <a href="https://www.linkedin.com/company/navgurukul" target="_blank" rel="noopener noreferrer" 
                               className="p-2 border-2 border-[#E91E63] rounded-full text-[#E91E63] hover:bg-[#E91E63] hover:text-white transition">
                                <Linkedin className="w-5 h-5" />
                            </a>
                            <a href="https://twitter.com/navgurukul" target="_blank" rel="noopener noreferrer" 
                               className="p-2 border-2 border-[#E91E63] rounded-full text-[#E91E63] hover:bg-[#E91E63] hover:text-white transition">
                                <Twitter className="w-5 h-5" />
                            </a>
                        </div>
                    </div>
                    
                    {/* Column 2: Links (FIXED HREFS) */}
                    <div className="flex flex-col">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Links</h3>
                        <ul className="space-y-2 text-md text-gray-700">
                            {/* Link to About Us section */}
                            <li><a href="#about-us" className="hover:text-[#E91E63] transition">About Us</a></li>
                            {/* Link to Features section */}
                            <li><a href="#features" className="hover:text-[#E91E63] transition">Features</a></li>
                            {/* Link to Hero/User Experience section */}
                            <li><a href="#hero-section" className="hover:text-[#E91E63] transition">User Experience</a></li>
                        </ul>
                    </div>

                    {/* Column 3: AJMF Logo (FIXED SRC) */}
                    <div className="w-32 h-32 flex items-center justify-center">
                        <img 
                            // ✅ CORRECT FIX: Use the root public path without the '/public/' prefix in the URL
                            src="/public/AJMF.jpeg" 
                            alt="Anish Jadhav Memorial Foundation Logo" 
                            className="w-full h-auto object-contain"
                        />
                    </div>
                </div>

                {/* 2. TEAM SECTION: Developer Contacts (omitted for brevity) */}
                <div className="flex flex-col md:flex-row justify-around items-start space-y-8 md:space-y-0 text-center mb-8">
                    {devData.map((dev) => (
                        <DevContact 
                            key={dev.name}
                            name={dev.name}
                            linkedInUrl={dev.linkedIn}
                            githubUrl={dev.github}
                            phoneUrl={dev.phone}
                        />
                    ))}
                </div>

                {/* 3. COPYRIGHT */}
                <div className="text-center pt-4 border-t border-gray-400/50">
                    <p className="text-sm text-gray-600">
                        &copy; {new Date().getFullYear()} Navgurukul. All rights reserved.
                    </p>
                </div>

            </div>
        </footer>
    );
};

export default Footer;