class Events {
  callbacks = [];
  nextId = 0;

  // emit event
  emit(eventName, value) {
    this.callbacks.forEach(stored => {
      if (stored.eventName === eventName) {
        stored.callback(value)
      }
    })
  }

  // subscribe to something happening
  on(eventName, caller, callback) {
    this.nextId += 1;
    this.callbacks.push({
      id: this.nextId,
      eventName,
      caller,
      callback,
    });
    return this.nextId;
  }

  // remove the subscription
  off(id) {
    this.callbacks = this.callbacks.filter((stored) => stored.id !== id);
  }

  unsubscribe(caller) {
    this.callbacks = this.callbacks.filter(
      (stored) => stored.caller !== caller,
    );
  }


}

// Chat Events
export const CHAT_MESSAGE_SENT = 'CHAT_MESSAGE_SENT';
export const CHAT_MESSAGE_RECEIVED = 'CHAT_MESSAGE_RECEIVED';
export const CHAT_ROOM_CHANGED = 'CHAT_ROOM_CHANGED';
export const CHAT_TYPING_INDICATOR = 'CHAT_TYPING_INDICATOR';

// Hero Events
export const HERO_ATTRIBUTES_UPDATE = 'HERO_ATTRIBUTES_UPDATE';

export const events = new Events();