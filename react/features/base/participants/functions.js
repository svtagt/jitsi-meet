// @flow
import { getAvatarURL as _getAvatarURL } from 'js-utils/avatar';

import { toState } from '../redux';

import { JitsiParticipantConnectionStatus } from '../lib-jitsi-meet';
import { MEDIA_TYPE, shouldRenderVideoTrack } from '../media';
import { getTrackByMediaTypeAndParticipant } from '../tracks';

import {
    DEFAULT_AVATAR_RELATIVE_PATH,
    LOCAL_PARTICIPANT_DEFAULT_ID,
    MAX_DISPLAY_NAME_LENGTH,
    PARTICIPANT_ROLE
} from './constants';

declare var config: Object;
declare var interfaceConfig: Object;

/**
 * Returns the URL of the image for the avatar of a specific participant.
 *
 * @param {Participant} [participant] - The participant to return the avatar URL
 * of.
 * @param {string} [participant.avatarID] - Participant's avatar ID.
 * @param {string} [participant.avatarURL] - Participant's avatar URL.
 * @param {string} [participant.email] - Participant's e-mail address.
 * @param {string} [participant.id] - Participant's ID.
 * @public
 * @returns {string} The URL of the image for the avatar of the specified
 * participant.
 */
export function getAvatarURL({ avatarID, avatarURL, email, id }: {
        avatarID: string,
        avatarURL: string,
        email: string,
        id: string
}) {
    // If disableThirdPartyRequests disables third-party avatar services, we are
    // restricted to a stock image of ours.
    if (typeof config === 'object' && config.disableThirdPartyRequests) {
        return DEFAULT_AVATAR_RELATIVE_PATH;
    }

    // If an avatarURL is specified, then obviously there's nothing to generate.
    if (avatarURL) {
        return avatarURL;
    }

    // The deployment is allowed to choose the avatar service which is to
    // generate the random avatars.
    const avatarService
        = typeof interfaceConfig === 'object'
                && interfaceConfig.RANDOM_AVATAR_URL_PREFIX
            ? {
                urlPrefix: interfaceConfig.RANDOM_AVATAR_URL_PREFIX,
                urlSuffix: interfaceConfig.RANDOM_AVATAR_URL_SUFFIX }
            : undefined;

    // eslint-disable-next-line object-property-newline
    return _getAvatarURL({ avatarID, email, id }, avatarService);
}

/**
 * Returns the avatarURL for the participant associated with the passed in
 * participant ID.
 *
 * @param {(Function|Object|Participant[])} stateful - The redux state
 * features/base/participants, the (whole) redux state, or redux's
 * {@code getState} function to be used to retrieve the state
 * features/base/participants.
 * @param {string} id - The ID of the participant to retrieve.
 * @param {boolean} isLocal - An optional parameter indicating whether or not
 * the partcipant id is for the local user. If true, a different logic flow is
 * used find the local user, ignoring the id value as it can change through the
 * beginning and end of a call.
 * @returns {(string|undefined)}
 */
export function getAvatarURLByParticipantId(
        stateful: Object | Function,
        id: string = LOCAL_PARTICIPANT_DEFAULT_ID) {
    const participant = getParticipantById(stateful, id);

    return participant && getAvatarURL(participant);
}

/**
 * Returns local participant from Redux state.
 *
 * @param {(Function|Object|Participant[])} stateful - The redux state
 * features/base/participants, the (whole) redux state, or redux's
 * {@code getState} function to be used to retrieve the state
 * features/base/participants.
 * @returns {(Participant|undefined)}
 */
export function getLocalParticipant(stateful: Object | Function) {
    const participants = _getAllParticipants(stateful);

    return participants.find(p => p.local);
}

/**
 * Normalizes a display name so then no invalid values (padding, length...etc)
 * can be set.
 *
 * @param {string} name - The display name to set.
 * @returns {string}
 */
export function getNormalizedDisplayName(name: string) {
    if (!name || !name.trim()) {
        return undefined;
    }

    return name.trim().substring(0, MAX_DISPLAY_NAME_LENGTH);
}

/**
 * Returns participant by ID from Redux state.
 *
 * @param {(Function|Object|Participant[])} stateful - The redux state
 * features/base/participants, the (whole) redux state, or redux's
 * {@code getState} function to be used to retrieve the state
 * features/base/participants.
 * @param {string} id - The ID of the participant to retrieve.
 * @private
 * @returns {(Participant|undefined)}
 */
export function getParticipantById(
        stateful: Object | Function, id: string): ?Object {
    const participants = _getAllParticipants(stateful);

    return participants.find(p => p.id === id);
}

/**
 * Returns a count of the known participants in the passed in redux state,
 * excluding any fake participants.
 *
 * @param {(Function|Object|Participant[])} stateful - The redux state
 * features/base/participants, the (whole) redux state, or redux's
 * {@code getState} function to be used to retrieve the state
 * features/base/participants.
 * @returns {number}
 */
export function getParticipantCount(stateful: Object | Function) {
    return getParticipants(stateful).length;
}

/**
 * Returns a count of the known participants in the passed in redux state,
 * including fake participants.
 *
 * @param {(Function|Object|Participant[])} stateful - The redux state
 * features/base/participants, the (whole) redux state, or redux's
 * {@code getState} function to be used to retrieve the state
 * features/base/participants.
 * @returns {number}
 */
export function getParticipantCountWithFake(stateful: Object | Function) {
    return _getAllParticipants(stateful).length;
}

/**
 * Returns participant's display name.
 *
 * FIXME: Remove the hardcoded strings once interfaceConfig is stored in redux
 * and merge with a similarly named method in {@code conference.js}.
 *
 * @param {(Function|Object)} stateful - The (whole) redux state, or redux's
 * {@code getState} function to be used to retrieve the state.
 * @param {string} id - The ID of the participant's display name to retrieve.
 * @private
 * @returns {string}
 */
export function getParticipantDisplayName(
        stateful: Object | Function,
        id: string) {
    const participant = getParticipantById(stateful, id);

    if (participant) {
        if (participant.name) {
            return participant.name;
        }

        if (participant.local) {
            return typeof interfaceConfig === 'object'
                ? interfaceConfig.DEFAULT_LOCAL_DISPLAY_NAME
                : 'me';
        }
    }

    return typeof interfaceConfig === 'object'
        ? interfaceConfig.DEFAULT_REMOTE_DISPLAY_NAME
        : 'Doctor';
}

/**
 * Returns the presence status of a participant associated with the passed id.
 *
 * @param {(Function|Object)} stateful - The (whole) redux state, or redux's
 * {@code getState} function to be used to retrieve the state.
 * @param {string} id - The id of the participant.
 * @returns {string} - The presence status.
 */
export function getParticipantPresenceStatus(
        stateful: Object | Function, id: string) {
    if (!id) {
        return undefined;
    }
    const participantById = getParticipantById(stateful, id);

    if (!participantById) {
        return undefined;
    }

    return participantById.presence;
}

/**
 * Selectors for getting all known participants with fake participants filtered
 * out.
 *
 * @param {(Function|Object|Participant[])} stateful - The redux state
 * features/base/participants, the (whole) redux state, or redux's
 * {@code getState} function to be used to retrieve the state
 * features/base/participants.
 * @returns {Participant[]}
 */
export function getParticipants(stateful: Object | Function) {
    return _getAllParticipants(stateful).filter(p => !p.isFakeParticipant);
}

/**
 * Returns the participant which has its pinned state set to truthy.
 *
 * @param {(Function|Object|Participant[])} stateful - The redux state
 * features/base/participants, the (whole) redux state, or redux's
 * {@code getState} function to be used to retrieve the state
 * features/base/participants.
 * @returns {(Participant|undefined)}
 */
export function getPinnedParticipant(stateful: Object | Function) {
    return _getAllParticipants(stateful).find(p => p.pinned);
}

/**
 * Returns array of participants from Redux state.
 *
 * @param {(Function|Object|Participant[])} stateful - The redux state
 * features/base/participants, the (whole) redux state, or redux's
 * {@code getState} function to be used to retrieve the state
 * features/base/participants.
 * @private
 * @returns {Participant[]}
 */
function _getAllParticipants(stateful) {
    return (
        Array.isArray(stateful)
            ? stateful
            : toState(stateful)['features/base/participants'] || []);
}

/**
 * Returns true if all of the meeting participants are moderators.
 *
 * @param {Object|Function} stateful -Object or function that can be resolved
 * to the Redux state.
 * @returns {boolean}
 */
export function isEveryoneModerator(stateful: Object | Function) {
    const participants = _getAllParticipants(stateful);

    for (const participant of participants) {
        if (participant.role !== PARTICIPANT_ROLE.MODERATOR) {
            return false;
        }
    }

    return true;
}

/**
 * Returns true if the current local participant is a moderator in the
 * conference.
 *
 * @param {Object|Function} stateful - Object or function that can be resolved
 * to the Redux state.
 * @param {?boolean} ignoreToken - When true we ignore the token check.
 * @returns {boolean}
 */
export function isLocalParticipantModerator(
        stateful: Object | Function,
        ignoreToken: ?boolean = false) {
    const state = toState(stateful);
    const localParticipant = getLocalParticipant(state);

    if (!localParticipant) {
        return false;
    }

    return (
        localParticipant.role === PARTICIPANT_ROLE.MODERATOR
        && (ignoreToken
                || !state['features/base/config'].enableUserRolesBasedOnToken
                || !state['features/base/jwt'].isGuest));
}

/**
 * Returns true if the video of the participant should be rendered.
 *
 * @param {Object|Function} stateful - Object or function that can be resolved
 * to the Redux state.
 * @param {string} id - The ID of the participant.
 * @returns {boolean}
 */
export function shouldRenderParticipantVideo(
        stateful: Object | Function, id: string) {
    const state = toState(stateful);
    const participant = getParticipantById(state, id);

    if (!participant) {
        return false;
    }

    const audioOnly = state['features/base/conference'].audioOnly;
    const connectionStatus = participant.connectionStatus
        || JitsiParticipantConnectionStatus.ACTIVE;
    const videoTrack = getTrackByMediaTypeAndParticipant(
        state['features/base/tracks'],
        MEDIA_TYPE.VIDEO,
        id);

    // Is the video to be rendered?
    // FIXME It's currently impossible to have true as the value of
    // waitForVideoStarted because videoTrack's state videoStarted will be
    // updated only after videoTrack is rendered.
    // XXX Note that, unlike on web, we don't render video when the
    // connection status is interrupted, this is because the renderer
    // doesn't retain the last frame forever, so we would end up with a
    // black screen.
    const waitForVideoStarted = false;

    return !audioOnly
        && (connectionStatus
            === JitsiParticipantConnectionStatus.ACTIVE)
        && shouldRenderVideoTrack(videoTrack, waitForVideoStarted);

}
