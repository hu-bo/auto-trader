import '@/styles/tailwind.css'
import '@douyinfe/semi-ui-19/react19-adapter';
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// import '@douyinfe/semi-ui-19/dist/css/semi.min.css'
import '@/styles/global.less'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
