import React, { createContext, useContext, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;

    const socketUrl = `${protocol}//${host}/ws?token=${user.token}`;

    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      console.log("WebSocket connected:", socketUrl);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WS message:", data);
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
    };

    socket.onerror = (err) => {
      console.error("WS error:", err);
    };

    socketRef.current = socket;

    return () => socket.close();
  }, [user]);

  const sendMessage = (msg) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  };

  return (
    <WebSocketContext.Provider value={{ sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};