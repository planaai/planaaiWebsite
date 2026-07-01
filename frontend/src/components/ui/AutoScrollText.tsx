import { useEffect, useRef, useState } from 'react';

interface AutoScrollTextProps {
  text: string;
  className?: string;
}

export function AutoScrollText({ text, className = '' }: AutoScrollTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const check = () => {
      if (containerRef.current && measureRef.current) {
        const tWidth = isOverflowing ? measureRef.current.offsetWidth : measureRef.current.scrollWidth;
        setIsOverflowing(tWidth > containerRef.current.clientWidth + 2);
      }
    };
    check();
    const t1 = setTimeout(check, 100);
    const t2 = setTimeout(check, 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [text, isOverflowing]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap w-full flex items-center ${isOverflowing ? 'justify-start' : 'justify-center'} ${className} relative`}
    >
      {isOverflowing ? (
        <>
          <div className="inline-block animate-marquee-continuous whitespace-nowrap w-max">
            <span className="inline-block mr-6">{text}</span>
            <span className="inline-block mr-6">{text}</span>
          </div>
          <span ref={measureRef} className="absolute top-0 left-0 opacity-0 pointer-events-none whitespace-nowrap">
            {text}
          </span>
        </>
      ) : (
        <span ref={measureRef} className="block truncate text-center w-full">
          {text}
        </span>
      )}
    </div>
  );
}
