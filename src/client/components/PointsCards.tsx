import { Show } from "solid-js";
import { store } from "../store/app-store";
import AnimatedPoints from "./AnimatedPoints";

export default function PointCards() {
  return (
    <Show when={store.activeUser}>
      <div class="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md shadow-xl flex items-center justify-between gap-6 group">
        {/* Background ambient highlights */}
        <div class="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-indigo-500/10 blur-3xl transition-all group-hover:bg-indigo-500/20" />
        <div class="absolute -left-16 -bottom-16 h-36 w-36 rounded-full bg-purple-500/10 blur-3xl transition-all group-hover:bg-purple-500/20" />

        <div class="relative z-10">
          <p class="text-xs font-bold uppercase tracking-widest text-indigo-400">
            Accumulated Balance
          </p>
          <h2 class="text-4xl font-black mt-1 text-white">
            {store.activeUser!.name}
          </h2>
        </div>
        {/* Right: Smooth Ticking Points Balance */}
        <div class="relative z-10 text-right">
          <p class="text-xs font-bold uppercase tracking-widest text-purple-400">
            Accumulated Balance
          </p>
          <h2 class="text-3xl font-black mt-1 text-white flex items-center justify-end gap-1.5">
            ⭐ <AnimatedPoints value={store.activeUser!.points} />
          </h2>
        </div>
      </div>
    </Show>
  );
}
