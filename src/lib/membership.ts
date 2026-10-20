import type { Bloc, BlocMember } from '../data/types';

/**
 * The one counting rule for "members": full members are counted and summed;
 * suspended and frozen members are listed beside them but never added to
 * counts or figures. Partners, observers and invitees are neither.
 */
export function blocMembers(bloc: Bloc): { full: string[]; suspended: BlocMember[] } {
  return {
    full: bloc.members.filter((m) => m.status === 'member').map((m) => m.iso),
    suspended: bloc.members.filter((m) => m.status === 'suspended' || m.status === 'frozen'),
  };
}
