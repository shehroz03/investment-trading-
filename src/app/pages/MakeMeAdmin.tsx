import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function MakeMeAdmin() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Making you an admin...");

  useEffect(() => {
    async function makeAdmin() {
      if (!user) {
        setStatus("You must be logged in first!");
        return;
      }
      
      const { error } = await supabase
        .from("users")
        .update({ role: "admin" })
        .eq("id", user.id);
        
      if (error) {
        setStatus("Error making admin: " + error.message);
      } else {
        setStatus("Success! You are now an admin. Redirecting to Admin Panel...");
        setTimeout(() => {
          // Force a hard reload so the AuthContext fetches the new role
          window.location.href = "/admin";
        }, 2000);
      }
    }
    
    makeAdmin();
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090B] text-white">
      <div className="p-6 bg-[#151B23] border border-white/10 rounded-xl">
        <h1 className="text-xl font-bold mb-4">Admin Access Upgrade</h1>
        <p className="text-teal-400">{status}</p>
      </div>
    </div>
  );
}
