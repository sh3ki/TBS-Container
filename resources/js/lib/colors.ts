/**
 * FJPWL Container Management System - Color Scheme
 * Professional, Modern, Minimalist Design
 * Light Mode Only
 */

export const colors = {
  // Main Colors
  main: '#FFFFFF',
  secondary: '#EDEEEB',
  tertiary: '#CCC7BF',
  
  // Text Colors
  text: {
    primary: '#000000',
    secondary: '#31393C',
  },
  
  // Brand Colors
  brand: {
    primary: '#3E9AF4', // Header/Accent Blue
    secondary: '#31393C', // Dark Gray
  },
  
  // Sidebar
  sidebar: {
    background: '#31393C',
    text: '#FFFFFF',
    hover: '#3E9AF4',
    active: '#3E9AF4',
  },
  
  // Action Buttons
  actions: {
    add: '#10B981', // Green
    edit: '#F59E0B', // Yellow/Amber
    delete: '#EF4444', // Red
    toggle: '#6B7280', // Gray
  },
  
  // Table
  table: {
    header: '#3E9AF4', // Blue
    headerText: '#FFFFFF',
    row: '#FFFFFF',
    rowAlt: '#F9FAFB',
    border: '#E5E7EB',
    hover: '#F3F4F6',
  },
  
  // Status Colors
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3E9AF4',
  },
  
  // Card/Container
  card: {
    background: '#FFFFFF',
    border: '#E5E7EB',
    shadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
  },
} as const;

export type ColorScheme = typeof colors;
