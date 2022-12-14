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

import { Component, OnDestroy, OnInit } from '@angular/core';
import { IonRefresher } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { CoreSite } from '@classes/site';
import { CoreSites } from '@services/sites';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import {
    CoreUser,
    CoreUserProfile,
    CoreUserProvider,
} from '@features/user/services/user';
import { CoreUserHelper } from '@features/user/services/user-helper';
import { CoreUserDelegate, CoreUserDelegateService, CoreUserProfileHandlerData } from '@features/user/services/user-delegate';
import { CoreUtils } from '@services/utils/utils';
import { CoreNavigator } from '@services/navigator';
import { CoreCourses } from '@features/courses/services/courses';

@Component({
    selector: 'page-core-user-profile',
    templateUrl: 'profile.html',
    styleUrls: ['profile.scss'],
})
export class CoreUserProfilePage implements OnInit, OnDestroy {

    protected courseId?: number;
    protected userId!: number;
    protected site!: CoreSite;
    protected obsProfileRefreshed: CoreEventObserver;
    protected subscription?: Subscription;

    userLoaded = false;
    isLoadingHandlers = false;
    user?: CoreUserProfile;
    title?: string;
    isDeleted = false;
    isEnrolled = true;
    rolesFormatted?: string;
    actionHandlers: CoreUserProfileHandlerData[] = [];
    newPageHandlers: CoreUserProfileHandlerData[] = [];
    communicationHandlers: CoreUserProfileHandlerData[] = [];

    constructor() {
        this.obsProfileRefreshed = CoreEvents.on(CoreUserProvider.PROFILE_REFRESHED, (data) => {
            if (!this.user || !data.user) {
                return;
            }

            this.user.email = data.user.email;
            this.user.address = CoreUserHelper.formatAddress('', data.user.city, data.user.country);
        }, CoreSites.getCurrentSiteId());
    }

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        try {
            this.site = CoreSites.getRequiredCurrentSite();
            this.courseId = CoreNavigator.getRouteNumberParam('courseId');
            this.userId = CoreNavigator.getRequiredRouteNumberParam('userId');
        } catch (error) {
            CoreDomUtils.showErrorModal(error);
            CoreNavigator.back();

            return;
        }

        if (this.courseId === this.site.getSiteHomeId()) {
            // Get site profile.
            this.courseId = undefined;
        }

        try {
            await this.fetchUser();

            if (!this.user) {
                return;
            }

            try {
                await CoreUser.logView(this.userId, this.courseId, this.user.fullname);
            } catch (error) {
                this.isDeleted = error?.errorcode === 'userdeleted';
                this.isEnrolled = error?.errorcode !== 'notenrolledprofile';
            }
        } finally {
            this.userLoaded = true;
        }
    }

    /**
     * Fetches the user and updates the view.
     */
    async fetchUser(): Promise<void> {
        try {
            const user = await CoreUser.getProfile(this.userId, this.courseId);

            user.address = CoreUserHelper.formatAddress('', user.city, user.country);
            this.rolesFormatted = 'roles' in user ? CoreUserHelper.formatRoleList(user.roles) : '';

            this.user = user;
            this.title = user.fullname;

            // If there's already a subscription, unsubscribe because we'll get a new one.
            this.subscription?.unsubscribe();

            this.subscription = CoreUserDelegate.getProfileHandlersFor(user, this.courseId).subscribe((handlers) => {
                this.actionHandlers = [];
                this.newPageHandlers = [];
                this.communicationHandlers = [];
                handlers.forEach((handler) => {
                    switch (handler.type) {
                        case CoreUserDelegateService.TYPE_COMMUNICATION:
                            this.communicationHandlers.push(handler.data);
                            break;
                        case CoreUserDelegateService.TYPE_ACTION:
                            this.actionHandlers.push(handler.data);
                            break;
                        case CoreUserDelegateService.TYPE_NEW_PAGE:
                        default:
                            this.newPageHandlers.push(handler.data);
                            break;
                    }
                });

                this.isLoadingHandlers = !CoreUserDelegate.areHandlersLoaded(user.id);
            });

        } catch (error) {
            // Error is null for deleted users, do not show the modal.
            CoreDomUtils.showErrorModal(error);
        }
    }

    /**
     * Refresh the user.
     *
     * @param event Event.
     * @return Promise resolved when done.
     */
    async refreshUser(event?: IonRefresher): Promise<void> {
        await CoreUtils.ignoreErrors(Promise.all([
            CoreUser.invalidateUserCache(this.userId),
            CoreCourses.invalidateUserNavigationOptions(),
            CoreCourses.invalidateUserAdministrationOptions(),
        ]));

        await this.fetchUser();

        event?.complete();

        if (this.user) {
            CoreEvents.trigger(CoreUserProvider.PROFILE_REFRESHED, {
                courseId: this.courseId,
                userId: this.userId,
                user: this.user,
            }, this.site?.getId());
        }
    }

    /**
     * Open the page with the user details.
     */
    openUserDetails(): void {
        CoreNavigator.navigateToSitePath('user/about', {
            params: {
                courseId: this.courseId,
                userId: this.userId,
            },
        });
    }

    /**
     * A handler was clicked.
     *
     * @param event Click event.
     * @param handler Handler that was clicked.
     */
    handlerClicked(event: Event, handler: CoreUserProfileHandlerData): void {
        if (!this.user) {
            return;
        }

        handler.action(event, this.user, this.courseId);
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
        this.obsProfileRefreshed.off();
    }

}
