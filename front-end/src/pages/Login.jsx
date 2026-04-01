import React from "react";
import LoginLeft from "../components/blocs/Login/LoginLeft";
import LoginRight from "../components/blocs/Login/LoginRight";

function Login() {
  return (
    <section className="min-h-screen w-full bg-background text-text-primary font-poppins">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <LoginLeft />
        <LoginRight />
      </div>
    </section>
  );
}

export default Login;
