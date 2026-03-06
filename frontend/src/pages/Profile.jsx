// import React, { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";

// // Prefer configuring the backend URL via env in production.
// // e.g. VITE_BACKEND_URL="https://api.yourdomain.com"
// // const SOCKET_URL = import.meta.env.VITE_MODE === 'production'
// //         ? import.meta.env.VITE_BASE_URL
// //         : 
// //         import.meta.env.VITE_BASE_URL_DEV;
// // const SOCKET_URL = import.meta.env.VITE_BASE_URL_DEV;
// console.log(SOCKET_URL);
// const Profile = () => {
//   const [connected, setConnected] = useState(false);
//   const socketRef = useRef(null);

//   useEffect(() => {
//     // Create a single socket connection for this component
//     const socket = io(SOCKET_URL, {
//       withCredentials: true,
//       transports: ["websocket"],
//     });

//     socketRef.current = socket;

//     socket.on("connect", () => {
//       setConnected(true);
//       // Example: join a demo room; replace with real room id / auth in production
//       socket.emit("join-room", "demo-room");
//     });

//     socket.on("disconnect", () => {
//       setConnected(false);
//     });

//     // Clean up on unmount to prevent socket leaks
//     return () => {
//       socket.disconnect();
//       socketRef.current = null;
//     };
//   }, []);

//   const sendTestMessage = () => {
//     if (!socketRef.current) return;
//     socketRef.current.emit("message", "test-message-from-profile");
//   };

//   return (
//     <div className="bg-emerald-300 p-2 flex gap-2 items-center justify-center">
//       <span>profile</span>
//       <span className="text-xs">
//         {connected ? "Socket connected" : "Socket disconnected"}
//       </span>
//       <button
//         type="button"
//         className="bg-blue-500 p-1 text-white text-sm rounded"
//         onClick={sendTestMessage}
//         disabled={!connected}
//       >
//         Press Meee!
//       </button>
//     </div>
//   );
// };

// export default Profile;
