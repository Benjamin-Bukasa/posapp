import { RouterProvider } from "react-router-dom";
import "./App.css";
import router from "./routes/router.jsx";
import ToastContainer from "./components/ui/ToastContainer";

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer />
    </>
  );
}

export default App;
