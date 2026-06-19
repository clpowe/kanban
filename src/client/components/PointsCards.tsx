import { Show } from "solid-js";
import { store } from "../store/app-store";
import AnimatedPoints from "./AnimatedPoints";

export default function PointCards() {
  return (
    <Show when={store.activeUser && store.activeUser.type !== "parent"}>
      <div class="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md shadow-xl flex items-center justify-between gap-6 group">
        <div class="relative z-10">
          <p class="text-xs font-bold uppercase tracking-widest text-slate-400">
            Active Member
          </p>
          <h2 class="text-4xl font-black mt-1 text-slate-100 flex items-center gap-2.5">
            <Show when={store.activeUser!.image}>
              <span class="text-3xl select-none animate-bounce">
                {store.activeUser!.image}
              </span>
            </Show>
            {store.activeUser!.name}
          </h2>
        </div>
        {/* Right: Smooth Ticking Points Balance */}
        <div class="relative z-10 text-right">
          <p class="text-xs font-bold uppercase tracking-widest text-slate-400">
            Accumulated Balance
          </p>
          <h2 class="text-3xl font-black mt-1 text-slate-100 flex items-center justify-end gap-1.5">
            ⭐ <AnimatedPoints value={store.activeUser!.points} />
          </h2>
        </div>
      </div>
    </Show>
  );
}
