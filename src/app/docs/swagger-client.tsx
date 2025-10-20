"use client";

import SwaggerUI from "swagger-ui-react";

import "swagger-ui-react/swagger-ui.css";

interface SwaggerClientProps {
  readonly url: string;
}

export function SwaggerClient({ url }: SwaggerClientProps) {
  return (
    <SwaggerUI
      url={url}
      docExpansion="none"
      defaultModelsExpandDepth={1}
      defaultModelExpandDepth={1}
      showExtensions
    />
  );
}
