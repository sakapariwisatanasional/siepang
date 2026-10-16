/**
 * @license
 * SiEpang Design System — Core Design Tokens (RC1)
 * Single source of truth for colors, typography, spacing, radius, shadows, and breakpoints.
 */

export const TOKENS = {
  // Light-First Surfaces (Part 2 & Part 3)
  colors: {
    // SiEpang red-dominant identity inspired by event branding.
    pageBackground: '#FAF8F4',
    surfacePrimary: '#FFFFFF',
    surfaceSecondary: '#FFF8F8',
    surfaceSoftWarm: '#FFF3F1',
    surfaceSoftPink: '#FFE8E8',

    // Text Colors
    textPrimary: '#1F1F1F',
    textSecondary: '#667085',
    textMuted: '#98A2B3',
    textWhite: '#FFFFFF',

    // Borders
    borderSubtle: '#F0DCDC',
    borderLight: '#F5E7E7',
    borderHighlight: 'rgba(215, 25, 32, 0.28)',

    // Event-inspired accents
    primary: '#D71920',
    primaryDark: '#B51218',
    primarySoft: '#FFE5E5',
    green: '#12B24B',
    greenDark: '#0B8E3A',
    greenSoft: '#E8F8EE',
    yellow: '#F4D53F',
    yellowSoft: '#FFF8D9',
    purple: '#6F2DA8',
    purpleSoft: '#F3EAFE',
    black: '#1F1F1F',
    cream: '#FAF8F4',

    accents: {
      red: '#D71920',
      redDark: '#B51218',
      green: '#12B24B',
      yellow: '#F4D53F',
      purple: '#6F2DA8',
      black: '#1F1F1F',
      // Legacy aliases retained so existing UI consumers keep compiling.
      violet: '#6F2DA8',
      magenta: '#B51218',
      pink: '#D71920',
      orange: '#F4A53A',
    },

    pastels: {
      red: '#FFF0F0',
      redBorder: '#FFD0D0',
      purple: '#F5F0FA',
      purpleBorder: '#E2D4EF',
      blue: '#EFF6FF',
      blueBorder: '#BFDBFE',
      green: '#ECFDF5',
      greenBorder: '#A7F3D0',
      orange: '#FFF7ED',
      orangeBorder: '#FED7AA',
      pink: '#FFF1F2',
      pinkBorder: '#FECDD3',
      amber: '#FEFCE8',
      amberBorder: '#FEF08A',
    },

    semantic: {
      success: '#12B24B',
      successLight: '#E8F8EE',
      warning: '#F59E0B',
      warningLight: '#FFFBEB',
      danger: '#D71920',
      dangerLight: '#FFE5E5',
      info: '#0284C7',
      infoLight: '#F0F9FF',
    },
  },

  // Gradients
  gradients: {
    scoutPrimary: 'linear-gradient(135deg, #B51218 0%, #D71920 55%, #EF4444 100%)',
    scoutSoft: 'linear-gradient(135deg, rgba(215, 25, 32, 0.10) 0%, rgba(18, 178, 75, 0.06) 55%, rgba(244, 213, 63, 0.10) 100%)',
    scoutCardBorder: 'linear-gradient(135deg, rgba(215, 25, 32, 0.30) 0%, rgba(18, 178, 75, 0.18) 55%, rgba(244, 213, 63, 0.25) 100%)',
  },

  // Breakpoints (Part 7)
  breakpoints: {
    xs: 320,
    sm: 375,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1440,
  },

  // Radius Tokens
  radius: {
    sm: '0.5rem',    // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.25rem',   // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.75rem', // 28px
    full: '9999px',
  },

  // Touch Target (Part 4)
  touchTarget: {
    min: '44px',
  },

  // Shadows
  shadows: {
    subtle: '0 1px 2px rgba(0, 0, 0, 0.04)',
    card: '0 2px 8px rgba(0, 0, 0, 0.04)',
    elevated: '0 4px 16px rgba(0, 0, 0, 0.06)',
    modal: '0 10px 30px rgba(0, 0, 0, 0.12)',
    buttonHighlight: '0 4px 14px rgba(225, 48, 108, 0.25)',
  },
} as const;

export type DesignTokens = typeof TOKENS;
