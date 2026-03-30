from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Event
from .serializers import EventSerializer

ALERT_THRESHOLD = 90


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    def get_queryset(self):
        queryset = Event.objects.all()
        event_type = self.request.query_params.get('type')
        alert = self.request.query_params.get('alert')
        limit = self.request.query_params.get('limit')

        if event_type:
            queryset = queryset.filter(type=event_type)
        if alert is not None:
            queryset = queryset.filter(alert=alert.lower() == 'true')
        if limit:
            queryset = queryset[:int(limit)]

        return queryset

    def perform_create(self, serializer):
        value = serializer.validated_data.get('value', 0)
        serializer.save(alert=value > ALERT_THRESHOLD)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = Event.objects.count()
        alerts = Event.objects.filter(alert=True).count()
        latest = Event.objects.first()
        return Response({
            'total': total,
            'alerts': alerts,
            'latest_value': latest.value if latest else None,
            'latest_source': latest.source if latest else None,
        })