// src/components/Layout.jsx - Requires this small update!

import { Outlet } from 'react-router-dom'; // 👈 Import Outlet
import Header from "./Header";
 

const Layout = () => {
  const HEADER_HEIGHT_PADDING = '72px'; 

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main 
        className="flex-grow" 
        style={{ paddingTop: HEADER_HEIGHT_PADDING }} 
      >
        <Outlet /> {/* 👈 Render the current nested page component here */}
      </main>
      
      
    </div>
  );
};

export default Layout;