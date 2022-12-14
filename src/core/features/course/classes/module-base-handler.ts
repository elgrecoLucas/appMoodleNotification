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

import { CoreNavigationOptions, CoreNavigator } from '@services/navigator';
import { CoreCourse } from '../services/course';
import { CoreCourseModule } from '../services/course-helper';
import { CoreCourseModuleHandler, CoreCourseModuleHandlerData } from '../services/module-delegate';

/**
 * Base module handler to be registered.
 */
export class CoreModuleHandlerBase implements Partial<CoreCourseModuleHandler> {

    protected pageName = '';

    /**
     * @inheritdoc
     */
    async isEnabled(): Promise<boolean> {
        return true;
    }

    /**
     * @inheritdoc
     */
    async getData(
        module: CoreCourseModule,
        courseId: number, // eslint-disable-line @typescript-eslint/no-unused-vars
        sectionId?: number, // eslint-disable-line @typescript-eslint/no-unused-vars
        forCoursePage?: boolean, // eslint-disable-line @typescript-eslint/no-unused-vars
    ): Promise<CoreCourseModuleHandlerData> {
        return {
            icon: await CoreCourse.getModuleIconSrc(module.modname, module.modicon),
            title: module.name,
            class: 'addon-mod_' + module.modname + '-handler',
            showDownloadButton: true,
            action: (event: Event, module: CoreCourseModule, courseId: number, options?: CoreNavigationOptions): void => {
                options = options || {};
                options.params = options.params || {};
                Object.assign(options.params, { module });
                const routeParams = '/' + courseId + '/' + module.id;

                CoreNavigator.navigateToSitePath(this.pageName + routeParams, options);
            },
        };
    }

}
