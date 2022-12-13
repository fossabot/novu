import { Injectable } from '@nestjs/common';
import {
  ISubscribersDefine,
  ITopic,
  TriggerRecipient,
  TriggerRecipientSubscriber,
  TriggerRecipientTopics,
  TriggerRecipients,
  TriggerRecipientsPayload,
} from '@novu/node';
import {
  EnvironmentId,
  LogCodeEnum,
  LogStatusEnum,
  OrganizationId,
  TopicId,
  TriggerRecipientsTypeEnum,
  UserId,
} from '@novu/shared';

import { MapTriggerRecipientsCommand } from './map-trigger-recipients.command';

import { CreateLog, CreateLogCommand } from '../../../logs/usecases/create-log';
import { GetTopicSubscribersCommand, GetTopicSubscribersUseCase } from '../../../topics/use-cases';

interface ILogTopicSubscribersPayload {
  environmentId: EnvironmentId;
  organizationId: OrganizationId;
  topicId: TopicId;
  transactionId: string;
  userId: UserId;
}

@Injectable()
export class MapTriggerRecipients {
  constructor(private createLog: CreateLog, private getTopicSubscribers: GetTopicSubscribersUseCase) {}

  async execute(command: MapTriggerRecipientsCommand): Promise<ISubscribersDefine[]> {
    const { environmentId, organizationId, recipients, transactionId, userId } = command;

    const mappedRecipients = Array.isArray(recipients) ? recipients : [recipients];

    const simpleSubscribers: ISubscribersDefine[] = this.findSubscribers(mappedRecipients);

    const topicSubscribers: ISubscribersDefine[] = await this.getSubscribersFromAllTopics(
      transactionId,
      environmentId,
      organizationId,
      userId,
      mappedRecipients
    );

    return [...simpleSubscribers, ...topicSubscribers];
  }

  private async getSubscribersFromAllTopics(
    transactionId: string,
    environmentId: EnvironmentId,
    organizationId: OrganizationId,
    userId: UserId,
    recipients: TriggerRecipients
  ): Promise<ISubscribersDefine[]> {
    const topics = this.findTopics(recipients);

    const topicSubscribers: ISubscribersDefine[] = [];

    for (const topic of topics) {
      try {
        const getTopicSubscribersCommand = GetTopicSubscribersCommand.create({
          environmentId,
          topicId: topic?.topicId || '',
          organizationId,
          userId,
        });
        const response = await this.getTopicSubscribers.execute(getTopicSubscribersCommand);
        const { subscribers } = response;

        subscribers.forEach((subscriber) => topicSubscribers.push({ subscriberId: subscriber }));
      } catch (error) {
        this.logTopicSubscribersError({
          environmentId,
          organizationId,
          topicId: topic?.topicId || '',
          transactionId,
          userId,
        });
      }
    }

    return topicSubscribers;
  }

  public mapSubscriber(subscriber: TriggerRecipientSubscriber): ISubscribersDefine {
    if (typeof subscriber === 'string') {
      return { subscriberId: subscriber };
    }

    return subscriber;
  }

  private findSubscribers(recipients: TriggerRecipients): ISubscribersDefine[] {
    const isNotTopic = (recipient: TriggerRecipientSubscriber): recipient is TriggerRecipientSubscriber =>
      typeof recipient === 'string' || recipient?.type !== TriggerRecipientsTypeEnum.TOPIC;

    return recipients.filter(isNotTopic).map(this.mapSubscriber);
  }

  private findTopics(recipients: TriggerRecipients): TriggerRecipientTopics {
    const isTopic = (recipient: ITopic): recipient is ITopic => recipient?.type === TriggerRecipientsTypeEnum.TOPIC;

    return recipients.filter(isTopic);
  }

  private logTopicSubscribersError({
    environmentId,
    organizationId,
    topicId,
    transactionId,
    userId,
  }: ILogTopicSubscribersPayload) {
    this.createLog
      .execute(
        CreateLogCommand.create({
          transactionId,
          status: LogStatusEnum.ERROR,
          environmentId,
          organizationId,
          text: 'Failed retrieving topic subscribers',
          userId,
          code: LogCodeEnum.TOPIC_SUBSCRIBERS_ERROR,
          raw: {
            topicId,
          },
        })
      )
      // eslint-disable-next-line no-console
      .catch((e) => console.error(e));
  }
}
