export interface NotificationProps {
  id: string | number;
  companyId?: string | null;
  senderUserId: string;
  recipientUserId?: string | null;
  recipientsEmails?: string[] | null;
  title: string;
  body: string;
  createdAt: Date;
  read: boolean;
  meta?: Record<string, any>;
}

export class Notification {
  private constructor(private props: NotificationProps) {}

  get id() {
    return this.props.id;
  }

  get companyId() {
    return this.props.companyId ?? null;
  }

  get senderUserId() {
    return this.props.senderUserId;
  }

  get recipientUserId() {
    return this.props.recipientUserId ?? null;
  }

  get recipientsEmails() {
    return this.props.recipientsEmails ?? [];
  }

  get title() {
    return this.props.title;
  }

  get body() {
    return this.props.body;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get read() {
    return this.props.read;
  }

  get meta() {
    return this.props.meta ?? {};
  }

  static create(props: NotificationProps): Notification {
    return new Notification(props);
  }

  markRead() {
    (this.props as any).read = true;
  }

  toJSON() {
    return {
      id: this.id,
      companyId: this.companyId,
      senderUserId: this.senderUserId,
      recipientUserId: this.recipientUserId,
      recipientsEmails: this.recipientsEmails,
      title: this.title,
      body: this.body,
      createdAt: this.createdAt.toISOString(),
      read: this.read,
      meta: this.meta,
    };
  }
}
