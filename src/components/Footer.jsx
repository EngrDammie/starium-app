// src/components/Footer.jsx
export default function Footer() {
  return (
    // 🎯 FIX: Added print:hidden
    // The "group" class tells Tailwind: "Watch when the user hovers anywhere over this entire footer"
    <footer className="print:hidden group relative w-full text-center py-5 bg-[#0a0a0a] border-t border-[#222] mt-auto cursor-default overflow-hidden">
      
      {/* This text hides when the footer is hovered (group-hover:opacity-0) */}
      <div className="text-[#666] text-sm transition-opacity duration-300 group-hover:opacity-0">
        Starium Rafa Quality Control Tool
      </div>

      {/* This text is invisible by default (opacity-0), but appears on hover (group-hover:opacity-100) */}
      <div className="absolute inset-0 flex items-center justify-center text-primary text-sm opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
        WhatsApp Dammie Optimus Solutions on 07053331253
      </div>

    </footer>
  );
}