// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Injectable, Type } from '@angular/core';
import { AddonModForum, AddonModForumProvider } from '../forum';
import { makeSingleton, Translate } from '@singletons';
import { CoreEvents } from '@singletons/events';
import { CoreSites } from '@services/sites';
import { CoreUtils } from '@services/utils/utils';
import { CoreCourseModuleHandler, CoreCourseModuleHandlerData } from '@features/course/services/module-delegate';
import { CoreConstants } from '@/core/constants';
import { AddonModForumIndexComponent } from '../../components/index';
import { CoreModuleHandlerBase } from '@features/course/classes/module-base-handler';
import { CoreCourseModule } from '@features/course/services/course-helper';

/**
 * Handler to support forum modules.
 */
@Injectable({ providedIn: 'root' })
export class AddonModForumModuleHandlerService extends CoreModuleHandlerBase implements CoreCourseModuleHandler {

    static readonly PAGE_NAME = 'mod_forum';

    name = 'AddonModForum';
    modName = 'forum';
    protected pageName = AddonModForumModuleHandlerService.PAGE_NAME;

    supportedFeatures = {
        [CoreConstants.FEATURE_GROUPS]: true,
        [CoreConstants.FEATURE_GROUPINGS]: true,
        [CoreConstants.FEATURE_MOD_INTRO]: true,
        [CoreConstants.FEATURE_COMPLETION_TRACKS_VIEWS]: true,
        [CoreConstants.FEATURE_COMPLETION_HAS_RULES]: true,
        [CoreConstants.FEATURE_GRADE_HAS_GRADE]: true,
        [CoreConstants.FEATURE_GRADE_OUTCOMES]: true,
        [CoreConstants.FEATURE_BACKUP_MOODLE2]: true,
        [CoreConstants.FEATURE_SHOW_DESCRIPTION]: true,
        [CoreConstants.FEATURE_RATE]: true,
        [CoreConstants.FEATURE_PLAGIARISM]: true,
    };

    /**
     * @inheritdoc
     */
    async getData(module: CoreCourseModule, courseId: number): Promise<CoreCourseModuleHandlerData> {
        const data = await super.getData(module, courseId);

        if ('afterlink' in module && !!module.afterlink) {
            data.extraBadgeColor = '';
            const match = />(\d+)[^<]+/.exec(module.afterlink);
            data.extraBadge = match ? Translate.instant('addon.mod_forum.unreadpostsnumber', { $a : match[1] }) : '';
        } else {
            this.updateExtraBadge(data, courseId, module.id);
        }

        const event = CoreEvents.on(
            AddonModForumProvider.MARK_READ_EVENT,
            eventData => {
                if (eventData.courseId !== courseId || eventData.moduleId !== module.id) {
                    return;
                }

                this.updateExtraBadge(data, eventData.courseId, eventData.moduleId, eventData.siteId);
            },
            CoreSites.getCurrentSiteId(),
        );

        data.onDestroy = () => event.off();

        return data;
    }

    /**
     * @inheritdoc
     */
    async getMainComponent(): Promise<Type<unknown> | undefined> {
        return AddonModForumIndexComponent;
    }

    /**
     * @inheritdoc
     */
    displayRefresherInSingleActivity(): boolean {
        return false;
    }

    /**
     * Triggers an update for the extra badge text.
     *
     * @param data Course Module Handler data.
     * @param courseId Course ID.
     * @param moduleId Course module ID.
     * @param siteId Site ID. If not defined, current site.
     */
    async updateExtraBadge(data: CoreCourseModuleHandlerData, courseId: number, moduleId: number, siteId?: string): Promise<void> {
        siteId = siteId || CoreSites.getCurrentSiteId();

        if (!siteId) {
            return;
        }

        data.extraBadge = Translate.instant('core.loading');
        data.extraBadgeColor = 'light';

        await CoreUtils.ignoreErrors(AddonModForum.invalidateForumData(courseId));

        try {
            // Handle unread posts.
            const forum = await AddonModForum.getForum(courseId, moduleId, { siteId });

            data.extraBadgeColor = '';
            data.extraBadge = forum.unreadpostscount
                ? Translate.instant(
                    'addon.mod_forum.unreadpostsnumber',
                    { $a : forum.unreadpostscount },
                )
                : '';
        } catch {
            // Ignore errors.
            data.extraBadgeColor = '';
            data.extraBadge = '';
        }
    }

}

export const AddonModForumModuleHandler = makeSingleton(AddonModForumModuleHandlerService);
