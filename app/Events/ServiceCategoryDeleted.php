<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ServiceCategoryDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $serviceCategoryId;

    /**
     * Create a new event instance.
     */
    public function __construct(int $serviceCategoryId)
    {
        $this->serviceCategoryId = $serviceCategoryId;
    }

    public function broadcastAs(): string
    {
        return 'servicecategory.deleted';
    }

    public function broadcastWith(): array
    {
        return [
            'serviceCategoryId' => $this->serviceCategoryId,
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
            new Channel('workshop.servicecategories'),
        ];
    }
}
