"use client";

import React from "react";
import { Layers } from "lucide-react";

interface RoomFilterProps {
  rooms: string[];
  selectedRoom: string;
  onSelectRoom: (room: string) => void;
  roomCounts: Record<string, number>;
}

export const RoomFilter: React.FC<RoomFilterProps> = ({
  rooms,
  selectedRoom,
  onSelectRoom,
  roomCounts,
}) => {
  const allRooms = ["All", ...rooms];

  return (
    <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1.5 mb-4 select-none">
      <div className="flex items-center text-xs font-semibold text-slate-500 mr-1 shrink-0">
        <Layers className="w-3.5 h-3.5 mr-1 text-slate-400" />
        <span>Rooms:</span>
      </div>

      {allRooms.map((room) => {
        const isSelected = selectedRoom === room;
        const count = room === "All" ? roomCounts["All"] || 0 : roomCounts[room] || 0;

        return (
          <button
            key={room}
            onClick={() => onSelectRoom(room)}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 border ${
              isSelected
                ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                : "bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200"
            }`}
          >
            <span>{room}</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                isSelected
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
