
import React from 'react';
import { 
  ShoppingCart, BookOpen, Headphones, FileText, BarChart, Scale, Film, Fuel, Gift, Brain, Heart, Activity, Zap,
  Cpu, Settings, Shield, Smartphone, MessageSquare, Moon, Users, DollarSign, TrendingUp, UserCheck, Landmark, Baby, Utensils, Compass, Plane
} from 'lucide-react';

interface ServiceIconProps {
  iconName: string;
  className?: string;
  size?: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  'BookOpen': BookOpen,
  'Headphones': Headphones,
  'FileText': FileText,
  'BarChart': BarChart,
  'Scale': Scale,
  'Film': Film,
  'Fuel': Fuel,
  'Gift': Gift,
  'Brain': Brain,
  'Heart': Heart,
  'Activity': Activity,
  'Zap': Zap,
  'Cpu': Cpu,
  'Settings': Settings,
  'Shield': Shield,
  'Smartphone': Smartphone,
  'MessageSquare': MessageSquare,
  'Moon': Moon,
  'Users': Users,
  'DollarSign': DollarSign,
  'TrendingUp': TrendingUp,
  'UserCheck': UserCheck,
  'Landmark': Landmark,
  'Baby': Baby,
  'Utensils': Utensils,
  'Compass': Compass,
  'Plane': Plane,
  'ShoppingCart': ShoppingCart // Fallback
};

export const ServiceIcon: React.FC<ServiceIconProps> = ({ iconName, className, size = 20 }) => {
  const IconComponent = ICON_MAP[iconName] || ShoppingCart;
  return <IconComponent className={className} size={size} />;
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);
