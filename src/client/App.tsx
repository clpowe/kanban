import { Router, Route } from '@solidjs/router'


function Board() {
    return <h1>Board — SolidJS is working! 🚀</h1>
}

function Archive() {
    return <h1>Archive</h1>
}
export default function App() {
    return (
        <Router>
            <Route path="/" component={Board} />
            <Route path="/archived" component={Archive} />
        </Router>
    )
}