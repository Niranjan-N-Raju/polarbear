"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import "swagger-ui-react/swagger-ui.css";

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  useEffect(() => { document.title = "API Docs · Polar Bear"; }, []);
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <span className="text-lg font-bold text-[#F47521]">Polar Bear</span>
        <span className="text-gray-300 select-none">|</span>
        <span className="text-sm font-semibold text-gray-700">
          API Documentation
        </span>
      </div>

      {/* Swagger UI */}
      <div className="swagger-wrapper">
        <SwaggerUI
          url="/api/docs"
          docExpansion="list"
          defaultModelsExpandDepth={1}
          displayRequestDuration
          tryItOutEnabled
        />
      </div>

      <style>{`
        .swagger-wrapper .swagger-ui .topbar { display: none; }
        .swagger-wrapper .swagger-ui .info { margin: 24px 0 8px; }
        .swagger-wrapper .swagger-ui .btn.authorize {
          border-color: #F47521;
          color: #F47521;
        }
        .swagger-wrapper .swagger-ui .btn.authorize svg { fill: #F47521; }
        .swagger-wrapper .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #F47521; }
        .swagger-wrapper .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #00A2C0; }
        .swagger-wrapper .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #e53e3e; }
        .swagger-wrapper .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #805ad5; }
      `}</style>
    </div>
  );
}
