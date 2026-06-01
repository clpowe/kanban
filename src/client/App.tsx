import { onMount, Show } from 'solid-js'
import { Router, Route } from '@solidjs/router'
import { store, isLoading, storeActions } from './store/app-store'


// Placeholder components to verify paths. We will build these fully in the next steps.
function Board() {
    return (
        <div class="p-8">
            <h1 class="text-3xl font-extrabold tracking-tight text-white mb-2">Household Board</h1>
            <p class="text-slate-400">SolidJS Kanban is connected and reactive! 🚀</p>
        </div>
    )
}

function Archive() {
    return (
        <div class="p-8">
            <h1 class="text-3xl font-extrabold tracking-tight text-white mb-2">Archived Tasks</h1>
            <p class="text-slate-400">Keep track of historical family accomplishments.</p>
        </div>
    )
}

export default function App() {
    // Bootstrap global reactive state when the application mounts
    onMount(() => {
        storeActions.initialize()
    })

    return (
        <Show
            when={!isLoading() || store.activeUser}
            fallback={
                <div class="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
                    <div class="relative flex items-center justify-center">
                        {/* Elegant glassmorphic pulsing rings */}
                        <div class="absolute h-24 w-24 rounded-full border border-indigo-500/30 animate-ping opacity-75" />
                        <div class="absolute h-16 w-16 rounded-full border border-violet-500/30 animate-pulse" />
                        <div class="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/30 flex items-center justify-center">
                            <span class="text-xs font-bold tracking-widest text-white/90">K</span>
                        </div>
                    </div>
                    <h2 class="mt-6 text-sm font-semibold tracking-wider uppercase text-slate-400 animate-pulse">
                        Syncing Household...
                    </h2>
                </div>
            }
        >
            <Router>
                <Route path="/" component={Board} />
                <Route path="/archived" component={Archive} />
            </Router>
        </Show>
    )
}