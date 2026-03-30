// components/ClientAppWrapper.jsx
'use client'; // This directive makes the entire file a Client Component
import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the App component with ssr: false inside the client component
const App = dynamic(() => import('../components/App'), { ssr: false });

export default function ClientAppWrapper(props) {
  return <App {...props} />;
}
