<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ServiceCategoryCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $serviceCategory;

    /**
     * Create a new event instance.
     */
    public function __construct(array $serviceCategory)
    {
        $this->serviceCategory = $serviceCategory;
    }

    public function broadcastAs(): string
    {
        return 'servicecategory.created';
    }

    public function broadcastWith(): array
    {
        return [
            'serviceCategory' => $this->serviceCategory,
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
