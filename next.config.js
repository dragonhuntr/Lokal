/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  // Performance optimizations

  // Enable standalone output for optimized Docker builds
  // This creates a minimal production build with only necessary files
  output: 'standalone',

  // Enable response compression for better network performance
  compress: true,

  // Optimize package imports to reduce bundle size
  // These packages are commonly large and benefit from tree-shaking
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'lodash',
    ],
  },

  // Image optimization configuration
  images: {
    // Enable modern image formats for better compression
    formats: ['image/avif', 'image/webp'],
    // Set reasonable device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Minimize layout shift during image loading
    minimumCacheTTL: 60,
  },

  // Production optimizations
  swcMinify: true, // Use SWC for faster minification
  poweredByHeader: false, // Remove X-Powered-By header for security

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Disable dev tools/indicators
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },
};

export default config;
