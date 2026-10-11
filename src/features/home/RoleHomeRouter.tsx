/**
 * @license
 * SiEpang - Role-Based Home Router (Requirements 2, 3, 4, 5, 6, 7, 8)
 * Dynamically renders the tailored homepage priority for each user role:
 * - PARTICIPANT
 * - COMMITTEE (PANITIA)
 * - JUDGE (DEWAN JURI)
 * - REGISTRATION_OFFICER
 * - ATTENDANCE_OFFICER
 * - HEALTH_OFFICER
 * - LOGISTIC_OFFICER
 * - EVENT_ADMIN / WORKSPACE_ADMIN
 * - SUPER_ADMIN
 */

import React from 'react';
import { UserRole } from '../../types';
import { NavTab } from '../../components/navigation/MobileNavigation';
import { ParticipantHome } from '../participants/ParticipantHome';
import { CommitteeHome } from './CommitteeHome';
import { JudgeHome } from './JudgeHome';
import { RegistrationOfficerHome } from './RegistrationOfficerHome';
import { AttendanceOfficerHome } from './AttendanceOfficerHome';
import { HealthOfficerHome } from './HealthOfficerHome';
import { LogisticsOfficerHome } from './LogisticsOfficerHome';
import { EventAdminHome } from './EventAdminHome';


interface RoleHomeRouterProps {
  role: UserRole;
  onNavigate: (tab: NavTab) => void;
  onOpenScanner: () => void;
  onOpenSyncCenter: () => void;
}

export const RoleHomeRouter: React.FC<RoleHomeRouterProps> = ({
  role,
  onNavigate,
  onOpenScanner,
  onOpenSyncCenter,
}) => {
  switch (role) {
    case 'participant':
    case 'viewer':
      return (
        <ParticipantHome
          onNavigate={onNavigate}
          onOpenScanner={onOpenScanner}
        />
      );

    case 'committee':
    case 'ceremony_officer':
      return (
        <CommitteeHome
          onNavigate={onNavigate}
          onOpenScanner={onOpenScanner}
        />
      );

    case 'judge':
      return (
        <JudgeHome
          onNavigate={onNavigate}
        />
      );

    case 'registration_officer':
    case 'kontingen_admin':
      return (
        <RegistrationOfficerHome
          onNavigate={onNavigate}
          onOpenScanner={onOpenScanner}
        />
      );

    case 'attendance_officer':
      return (
        <AttendanceOfficerHome
          onNavigate={onNavigate}
          onOpenScanner={onOpenScanner}
        />
      );

    case 'health_officer':
      return (
        <HealthOfficerHome
          onNavigate={onNavigate}
        />
      );

    case 'logistic_officer':
      return (
        <LogisticsOfficerHome
          onNavigate={onNavigate}
        />
      );

    case 'superadmin':
    case 'workspace_admin':
    case 'event_admin':
    default:
      return (
        <EventAdminHome
          onNavigate={onNavigate}
          onOpenScanner={onOpenScanner}
          onOpenSyncCenter={onOpenSyncCenter}
          canManageUsers={role === 'superadmin' || role === 'workspace_admin'}
        />
      );
  }
};
