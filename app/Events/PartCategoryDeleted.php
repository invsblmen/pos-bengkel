<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PartCategoryDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $partCategoryId;

    /**
     * Create a new event instance.
     */
    public function __construct(int $partCategoryId)
    {
        $this->partCategoryId = $partCategoryId;
    }

    public function broadcastAs(): string
    {
        return 'partcategory.deleted';
    }

    public function broadcastWith(): array
    {
        return [
            'partCategoryId' => $this->partCategoryId,
        ];
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('workshop.partcategories'),
        ];
    }
}
