import { Radio } from "lucide-react";
import Image from "next/image";

export function IdleStage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 pointer-events-none opacity-25 select-none">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-card shadow-sm">
        <Radio
          className="h-7 w-7 text-muted-foreground animate-pulse"
          style={{ animationDuration: "3s" }}
        />
      </div>
      <Image
        src="/niribi.png"
        alt="Niribi"
        width={72}
        height={29}
        className="mt-5 h-5 w-auto opacity-70"
      />
    </div>
  );
}
