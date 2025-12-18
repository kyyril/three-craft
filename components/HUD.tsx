
import React, { useState, useEffect, useRef } from 'react';
import { BlockType } from '../Technical/types';
import { ITEM_PROPERTIES, HOTBAR_SIZE } from '../Technical/constants';

interface HUDProps {
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  fps: number;
  health?: number;
  hunger?: number;
  oxygen?: number;
  isUnderwater?: boolean;
  mode?: string;
  inventory?: (any | null)[];
  isInventoryOpen?: boolean;
  onSwapItems?: (a: number, b: number) => void;
  timeScale?: number;
  isTimePaused?: boolean;
}

const HUD: React.FC<HUDProps> = ({ 
  selectedIndex, 
  onSelectIndex, 
  fps, 
  health = 20,
  hunger = 20,
  oxygen = 100, 
  isUnderwater = false, 
  mode = 'Creative',
  inventory = [],
  isInventoryOpen = false,
  onSwapItems,
  timeScale = 1,
  isTimePaused = false
}) => {
  const [showName, setShowName] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const nameTimeoutRef = useRef<any>(null);

  const selectedItem = inventory[selectedIndex];

  useEffect(() => {
    setShowName(true);
    if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
    nameTimeoutRef.current = setTimeout(() => setShowName(false), 2000);
    return () => {
      if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
    };
  }, [selectedIndex]);

  const showOxygen = isUnderwater || oxygen < 100;
  const isSurvival = mode === 'Survival';

  const renderItemSlot = (index: number, isHotbar: boolean = false) => {
    const item = inventory[index];
    const isSelected = isHotbar && selectedIndex === index;
    const prop = item ? ITEM_PROPERTIES[item.id] || ITEM_PROPERTIES[item.blockType] : null;

    const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      if (draggedIndex !== null && onSwapItems) {
        onSwapItems(draggedIndex, index);
      }
      setDraggedIndex(null);
    };

    return (
      <div
        key={index}
        draggable={!!item}
        onDragStart={() => setDraggedIndex(index)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => isHotbar && onSelectIndex(index)}
        className={`w-12 h-12 border-2 transition-all flex flex-col items-center justify-center relative group select-none cursor-pointer ${
          isSelected 
            ? 'border-white scale-110 bg-white/20 z-10 shadow-[0_0_20px_rgba(255,255,255,0.4)]' 
            : 'border-transparent bg-black/60 hover:bg-white/10'
        }`}
        style={prop ? { backgroundColor: prop.color } : {}}
      >
        {isHotbar && (
          <span className={`absolute top-0.5 left-1 text-[8px] font-bold ${isSelected ? 'text-white' : 'text-white/50'}`}>
            {index + 1}
          </span>
        )}
        
        {item && prop && (
          <div className="flex flex-col items-center justify-center w-full h-full p-1 text-center">
             <span className="text-[7px] font-black leading-none uppercase text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
               {item.name}
             </span>
             
             {isSurvival && (
                <div className="absolute bottom-1 left-1 right-1 h-1 bg-gray-900 border border-black overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      (item.durability / item.maxDurability) > 0.5 ? 'bg-green-500' : (item.durability / item.maxDurability) > 0.2 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${(item.durability / item.maxDurability) * 100}%` }}
                  />
                </div>
             )}
          </div>
        )}
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/pixel-weave.png')]"></div>
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 pointer-events-none flex flex-col justify-between p-4 text-white transition-colors duration-500 ${isUnderwater ? 'bg-blue-900/40' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="flex gap-2">
          <div className="bg-black/70 p-2 rounded text-[10px] uppercase tracking-widest font-bold font-mono border border-white/20 shadow-lg">
            VoxelCraft JS | FPS: {fps}
          </div>
          <div className={`bg-black/70 p-2 rounded text-[10px] uppercase tracking-widest font-bold font-mono border border-white/20 shadow-lg ${mode === 'Creative' ? 'text-blue-400' : 'text-green-400'}`}>
            Mode: {mode}
          </div>
          <div className="bg-black/70 p-2 rounded text-[10px] uppercase tracking-widest font-bold font-mono border border-white/20 shadow-lg flex items-center gap-2">
            <span className={isTimePaused ? 'text-red-500' : 'text-yellow-400'}>
              {isTimePaused ? 'TIME PAUSED' : `TIME: ${timeScale}x`}
            </span>
            <div className={`w-2 h-2 rounded-full ${isTimePaused ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-green-500 shadow-[0_0_8px_green] animate-pulse'}`}></div>
          </div>
        </div>
      </div>

      {isInventoryOpen && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-md z-50">
          <div className="bg-gray-900 p-6 border-4 border-gray-700 shadow-2xl flex flex-col gap-4">
            <h2 className="text-2xl font-bold uppercase tracking-tighter border-b border-gray-700 pb-3 flex justify-between items-center">
              <span>Inventory</span>
              <span className="text-xs text-gray-500 font-mono">36 SLOTS</span>
            </h2>
            
            <div className="grid grid-cols-9 gap-1.5">
              {Array.from({ length: 27 }).map((_, i) => renderItemSlot(i + 9))}
            </div>

            <div className="h-4 border-t border-gray-800" />

            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Hotbar</p>
              <div className="flex gap-1.5">
                {Array.from({ length: 9 }).map((_, i) => renderItemSlot(i, true))}
              </div>
            </div>

            <div className="text-[9px] text-gray-400 mt-4 flex justify-between uppercase font-bold tracking-widest">
              <span>DRAG TO REARRANGE</span>
              <span>PRESS 'E' TO EXIT</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-1 mb-2">
        {isSurvival && (
          <div className="flex flex-col items-center gap-1 mb-2 w-full max-w-[320px]">
            <div className="flex justify-between w-full px-2">
               <div className="flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const h = (i + 1) * 2;
                    const isFull = health >= h;
                    const isHalf = health >= h - 1 && health < h;
                    return (
                      <div key={i} className="w-4 h-4 relative">
                        <svg viewBox="0 0 24 24" className={`w-full h-full drop-shadow-md ${isFull ? 'fill-red-500' : isHalf ? 'fill-red-400' : 'fill-gray-800'}`}>
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </div>
                    );
                  })}
               </div>
               <div className="flex gap-0.5 flex-row-reverse">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const h = (i + 1) * 2;
                    const isFull = hunger >= h;
                    const isHalf = hunger >= h - 1 && hunger < h;
                    return (
                      <div key={i} className="w-4 h-4 relative">
                        <svg viewBox="0 0 24 24" className={`w-full h-full drop-shadow-md ${isFull ? 'fill-orange-800' : isHalf ? 'fill-orange-600' : 'fill-gray-800'}`}>
                          <path d="M18.5,3C17.1,3,16,4.1,16,5.5c0,1.2,0.8,2.2,2,2.5v2c0,1.1-0.9,2-2,2H5.5C4.1,12,3,13.1,3,14.5S4.1,17,5.5,17h11c1.9,0,3.5-1.6,3.5-3.5v-8C20,4.1,18.9,3,18.5,3z M7,17H5.5C4.7,17,4,16.3,4,15.5S4.7,14,5.5,14H7V17z M18,8c-1.1,0-2-0.9-2-2c0-1.1,0.9-2,2-2s2,0.9,2,2C20,7.1,19.1,8,18,8z" />
                        </svg>
                      </div>
                    );
                  })}
               </div>
            </div>
          </div>
        )}

        {showOxygen && (
          <div className="flex gap-1 mb-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div 
                key={i} 
                className={`w-3 h-3 rounded-full border border-blue-300 shadow-sm transition-all duration-300 ${oxygen >= (i + 1) * 10 ? 'bg-blue-400 scale-100 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-transparent scale-50 opacity-0'}`}
              />
            ))}
          </div>
        )}

        <div className={`transition-all duration-300 transform ${showName && selectedItem ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <span className="bg-black/80 px-4 py-1.5 rounded-sm text-xs uppercase tracking-widest font-black shadow-2xl border border-white/10 text-white">
            {selectedItem?.name || ''}
          </span>
        </div>

        <div className="flex justify-center w-full pointer-events-auto">
          <div className="flex gap-1.5 bg-black/90 p-2 border-4 border-gray-800 shadow-2xl rounded-sm">
            {Array.from({ length: 9 }).map((_, i) => renderItemSlot(i, true))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HUD;
