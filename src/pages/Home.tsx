import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
// Importing icons needed for Navbar, Feature section, and New Hero Section Features
import { ChefHat, LogOut, Calendar, BarChart2, Settings, Bell, CheckCircle } from "lucide-react"; 
import { useAuth } from "@/hooks/useAuth";

const Home = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/'); 
  };

  // Helper component for the new small feature cards
  const HeroFeatureCard = ({ title, description }) => (
    <div className="flex flex-col items-center p-4 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="w-5 h-5 text-red-500" />
        <h4 className="text-md font-semibold text-gray-800">{title}</h4>
      </div>
      <p className="text-center text-sm text-gray-600">{description}</p>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white p-2">
      {/* 1. --- Navbar (FIXED HEADER) --- */}
      <nav 
        className="flex items-center justify-between px-8 py-4 bg-[#FFE4E1] shadow-md 
                   fixed top-0 w-full z-10"
      >
        <div className="flex items-center gap-2">
          <ChefHat className="w-8 h-8 text-[#E91E63]" />
          <span className="text-2xl font-bold text-[#E91E63]">KitchenFlow</span>
        </div>
        
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

      {/* 2. --- Main Content Container --- */}
      <main className="flex-1 container mx-auto px-4 py-12 pt-[72px]"> 
        
        


        <section id="hero-section" className="bg-[#FFF]/50 pt-1 pb-12  rounded-xl  ">
            <div className=" mx-auto text-center">
                
                {/* Title & Logo */}
                <div className="flex justify-center items-center  gap-4 mb-4">
                    <h1 className="text-4xl font-extrabold text-[#E91E63]">
                        Welcome to 
                        <span className="ml-2 font-black text-[#FF4500]">KitchenFlow</span>
                    </h1>
                    {/* Placeholder for the torch logo from the image */}
                    <img 
                        src="/public/AJMF.jpeg" // Replace with actual path to your torch logo
                        alt="Navgurukul Torch Logo" 
                        className="h-20 w-auto object-contain"
                    />
                </div>
    <div className="text-[1.8rem] leading-none font-extrabold">
        <span className="text-[#E91E63] font-samarkan">nav</span>
        <span className="text-gray-900 font-samarkan">gurukul</span>
    </div>

                {/* Description */}
                <p className="text-md max-w-2xl mx-auto text-gray-700 leading-relaxed mb-8">
                    Kitchen Turn is a smart way to manage and organize daily kitchen duties 
                    in student hostels and communities. It helps track who is responsible, 
                    ensures fairness, and improves coordination.
                </p>

                {/* Image Gallery (Using a basic flex/grid layout to simulate the carousel look) */}
                <div className="relative flex items-center justify-center gap-3 overflow-hidden px-4">
                    {/* Left Arrow (Placeholder for functionality) */}
                    <div className="hidden md:block absolute left-0 text-3xl text-gray-500 cursor-pointer p-2 bg-white/50 rounded-full z-[5]">
                        &lt; 
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                        <img src="/public/cooking1.jpeg" alt="Students assigned turns" className="w-full h-auto rounded-lg shadow-lg object-cover max-h-64" />
                        <img src="/public/cooking2.jpeg" alt="Students cooking" className="w-full h-auto rounded-lg shadow-lg object-cover max-h-64" />
                        <img src="/public/cooking1.jpeg" alt="Students eating meal" className="w-full h-auto rounded-lg shadow-lg object-cover max-h-64" />
                    </div>

                    {/* Right Arrow (Placeholder for functionality) */}
                    <div className="hidden md:block absolute right-0 text-3xl text-gray-500 cursor-pointer p-2 bg-white/50 rounded-full z-[5]">
                        &gt; 
                    </div>
                </div>

                {/* Small Feature Blocks */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 px-4">
                    <HeroFeatureCard 
                        title="Fair Assignment" 
                        description="Students are assigned to kitchen turns fairly." 
                    />
                    <HeroFeatureCard 
                        title="Auto Updates" 
                        description="Daily team list is automatically updated." 
                    />
                    <HeroFeatureCard 
                        title="Smart Monitoring" 
                        description="Coordinator can manage and monitor turns." 
                    />
                </div>
                
               

            </div>
        </section>


        {/* --- Divider --- */}
        <hr className="border-t-2 border-[#FFE4E1] my-12" />

        
       


        <div id="about-us" className="py-8 px-4 sm:px-6 lg:px-8 bg-gray-50 rounded-xl shadow-inner mb-16">
          <h2 className="text-3xl font-extrabold text-[#E91E63] mb-4 text-center">
            About Us 
          </h2>
             <div className="max-w-4xl mx-auto space-y-6 text-center">
            <p className="text-lg text-gray-700 leading-relaxed">
              Our project  <span className="ml-2 font-black font-semibold text-[#000]">KitchenFlow</span> was born out of a common challenge faced by students at <div className="text-[1.8rem] leading-none font-extrabold">
        <span className="text-[#E91E63] text-lg font-samarkan">nav</span>
        <span className="text-gray-900  text-lg font-samarkan">gurukul</span>
    </div> managing daily kitchen duties efficiently and fairly. We saw that unorganized schedules and a lack of transparency often led to confusion and conflicts.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              To solve this, our team developed  <span className="ml-2 font-black font-semibold text-lg text-[#000]">KitchenFlow</span>. Our mission is to create a     <span className="ml-2 font-black font-semibold text-[#000]">seamless and transparent system</span> for managing kitchen responsibilities in student communities. We believe that with the right tools, everyone can contribute equally, ensuring a harmonious and clean living environment.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed font-semibold">
              This project is a testament to our learning at Navgurukul. We've used our skills to build a solution that not only solves a real-world problem but also promotes better coordination and fairness among students.
            </p>
          </div>

        </div>

        {/* --- Divider --- */}
        <hr className="border-t-2 border-[#FFE4E1] my-12" />

         


<section id="features" className="py-12 text-center">
           <div className="max-w-3xl mx-auto">
                <div className="text-5xl font-extrabold text-gray-900 mb-4 inline-block relative">
                    Why Choose KitchenFlow?
                     
                </div>
                <p className="text-xl text-gray-600 mt-4 mb-12">
                    Experience seamless kitchen management with our comprehensive suite of features designed for student communities.
                </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                
                {/* Feature Card 1: Smart Scheduling */}
                <div className="p-6 border border-gray-200 rounded-xl shadow-lg transition-transform hover:scale-[1.02] hover:shadow-xl bg-white">
                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-blue-100">
                        <Calendar className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Smart Scheduling</h3>
                    <p className="text-gray-600">
                        Automatically assign kitchen duties based on fair rotation and student availability.
                    </p>
                </div>

                {/* Feature Card 2: Analytics Dashboard */}
                <div className="p-6 border border-gray-200 rounded-xl shadow-lg transition-transform hover:scale-[1.02] hover:shadow-xl bg-white">
                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-green-100">
                        <BarChart2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Analytics Dashboard</h3>
                    <p className="text-gray-600">
                        Track participation, monitor completion rates, and generate detailed reports.
                    </p>
                </div>

                {/* Feature Card 3: Easy Management */}
                <div className="p-6 border border-gray-200 rounded-xl shadow-lg transition-transform hover:scale-[1.02] hover:shadow-xl bg-white">
                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-purple-100">
                        <Settings className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Easy Management</h3>
                    <p className="text-gray-600">
                        Coordinators can easily manage teams, adjust schedules, and handle exceptions.
                    </p>
                </div>

                {/* Feature Card 4: Smart Notifications */}
                <div className="p-6 border border-gray-200 rounded-xl shadow-lg transition-transform hover:scale-[1.02] hover:shadow-xl bg-white">
                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-orange-100">
                        <Bell className="w-8 h-8 text-orange-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Smart Notifications</h3>
                    <p className="text-gray-600">
                        Automated reminders ensure everyone knows their kitchen responsibilities.
                    </p>
                </div>

            </div>
        </section>

      </main>
    </div>
  );
};

export default Home;
