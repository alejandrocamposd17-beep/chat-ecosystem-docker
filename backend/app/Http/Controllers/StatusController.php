<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

class StatusController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'service' => config('app.name'),
            'status' => 'ok',
            'health' => url('/up'),
        ]);
    }
}
